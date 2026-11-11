import os
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict


COMPANIES_HOUSE_SEARCH_URL = (
    "https://api.company-information.service.gov.uk/search/companies"
)


class CompanySearchResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    items: list[dict[str, Any]]
    total_results: int | None = None
    items_per_page: int | None = None
    start_index: int | None = None


app = FastAPI(
    title="Companies House Proxy API",
    description=(
        "A small proxy for Companies House company search. The caller supplies "
        "their own Companies House API key with each request."
    ),
    version="1.0.0",
)

configured_origins = os.getenv("CORS_ORIGINS", "*").strip()
allowed_origins = (
    ["*"]
    if configured_origins == "*"
    else [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "X-Companies-House-Api-Key"],
)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": "Companies House Proxy API", "docs": "/docs"}


@app.get("/health", tags=["service"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/heartbeat", tags=["service"])
async def heartbeat() -> dict[str, str]:
    """A lightweight endpoint clients can call on startup to wake a Render instance."""
    return {"status": "awake"}


@app.get(
    "/api/companies/search",
    response_model=CompanySearchResponse,
    response_model_exclude_none=True,
    tags=["companies"],
)
async def search_companies(
    q: str = Query(..., min_length=1, max_length=160, description="Company name"),
    api_key: str = Header(..., alias="X-Companies-House-Api-Key", min_length=1),
) -> CompanySearchResponse:
    company_name = q.strip()
    if not company_name:
        raise HTTPException(status_code=422, detail="Enter a company name to search.")

    client_api_key = api_key.strip()
    if not client_api_key:
        raise HTTPException(
            status_code=422, detail="A Companies House API key is required."
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                COMPANIES_HOUSE_SEARCH_URL,
                params={"q": company_name, "items_per_page": 10},
                headers={"Accept": "application/json"},
                auth=(client_api_key, ""),
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504, detail="Companies House request timed out."
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502, detail="Could not reach Companies House."
        ) from exc

    if not response.is_success:
        status_code = (
            response.status_code
            if 400 <= response.status_code <= 599
            else 502
        )
        message = (
            "Companies House rejected the API key."
            if response.status_code == 401
            else f"Companies House request failed (HTTP {status_code})."
        )
        raise HTTPException(status_code=status_code, detail=message)

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502, detail="Companies House returned invalid JSON."
        ) from exc

    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise HTTPException(
            status_code=502, detail="Companies House returned an unexpected response."
        )
    return CompanySearchResponse.model_validate(data)
