import asyncio
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from httpx import AsyncClient as HttpxAsyncClient

import main


class FakeResponse:
    def __init__(self, status_code: int, data: object) -> None:
        self.status_code = status_code
        self.is_success = 200 <= status_code < 300
        self.data = data

    def json(self) -> object:
        if isinstance(self.data, Exception):
            raise self.data
        return self.data


class FakeAsyncClient:
    response = FakeResponse(200, {"items": [{"title": "ACME LTD"}]})
    request: dict[str, object] = {}

    def __init__(self, *, timeout: float) -> None:
        self.request = {"timeout": timeout}

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def get(self, url: str, **kwargs: object) -> FakeResponse:
        type(self).request = {"url": url, **kwargs, **self.request}
        return type(self).response


class CompaniesHouseApiTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeAsyncClient.response = FakeResponse(200, {"items": [{"title": "ACME LTD"}]})
        FakeAsyncClient.request = {}
        self.client_patch = patch.object(main.httpx, "AsyncClient", FakeAsyncClient)
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)

    def test_search_forwards_query_and_client_key_as_basic_auth(self) -> None:
        result = asyncio.run(main.search_companies(" ACME LTD ", " client-key "))

        self.assertEqual(
            result.model_dump(exclude_none=True),
            {"items": [{"title": "ACME LTD"}]},
        )
        request = FakeAsyncClient.request
        self.assertEqual(request["url"], main.COMPANIES_HOUSE_SEARCH_URL)
        self.assertEqual(request["params"], {"q": "ACME LTD", "items_per_page": 10})
        self.assertEqual(request["auth"], ("client-key", ""))
        self.assertNotIn("client-key", str(request["params"]))

    def test_rejected_api_key_is_reported_without_echoing_key(self) -> None:
        FakeAsyncClient.response = FakeResponse(401, {})

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(main.search_companies("ACME LTD", "secret-key"))

        self.assertEqual(raised.exception.status_code, 401)
        self.assertNotIn("secret-key", raised.exception.detail)

    def test_invalid_upstream_response_is_rejected(self) -> None:
        FakeAsyncClient.response = FakeResponse(200, {"unexpected": True})

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(main.search_companies("ACME LTD", "client-key"))

        self.assertEqual(raised.exception.status_code, 502)

    def test_health_and_heartbeat_do_not_call_upstream(self) -> None:
        self.assertEqual(asyncio.run(main.health()), {"status": "ok"})
        self.assertEqual(asyncio.run(main.heartbeat()), {"status": "awake"})
        self.assertEqual(FakeAsyncClient.request, {})

    def test_openapi_and_http_endpoint_expose_the_client_key_header(self) -> None:
        schema = main.app.openapi()
        search = schema["paths"]["/api/companies/search"]["get"]
        header_parameters = [
            parameter for parameter in search["parameters"]
            if parameter["in"] == "header"
        ]
        self.assertEqual(
            [parameter["name"] for parameter in header_parameters],
            ["X-Companies-House-Api-Key"],
        )

        async def make_request() -> httpx.Response:
            transport = httpx.ASGITransport(app=main.app)
            async with HttpxAsyncClient(
                transport=transport, base_url="http://testserver"
            ) as client:
                return await client.get(
                    "/api/companies/search?q=ACME",
                    headers={"X-Companies-House-Api-Key": "client-key"},
                )

        response = asyncio.run(make_request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"items": [{"title": "ACME LTD"}]})


if __name__ == "__main__":
    unittest.main()
