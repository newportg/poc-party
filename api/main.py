import os
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict


COMPANIES_HOUSE_SEARCH_URL = (
    "https://api.company-information.service.gov.uk/search/companies"
)
DATABASE_PATH = os.getenv(
    "PARTY_DB_PATH",
    os.path.join(os.path.dirname(__file__), "party.db"),
)


class PartyRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    type: str
    displayName: str
    status: str


class PartyListResponse(BaseModel):
    items: list[dict[str, Any]]


def initialize_database() -> None:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS parties (
                id TEXT PRIMARY KEY,
                record_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def read_party_rows() -> list[dict[str, Any]]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        rows = connection.execute(
            "SELECT record_json FROM parties ORDER BY updated_at DESC, id"
        ).fetchall()
    return [json.loads(row[0]) for row in rows]


def read_party(party_id: str) -> dict[str, Any] | None:
    with sqlite3.connect(DATABASE_PATH) as connection:
        row = connection.execute(
            "SELECT record_json FROM parties WHERE id = ?",
            (party_id,),
        ).fetchone()
    return json.loads(row[0]) if row else None


def write_party(record: dict[str, Any], *, expected_id: str | None = None) -> dict[str, Any]:
    party_id = expected_id or str(record["id"])
    now = str(record.get("updatedAt") or "")
    if not now:
        now = datetime.now(timezone.utc).isoformat()
    stored = {**record, "id": party_id, "updatedAt": now}
    stored.setdefault("createdAt", now)
    with sqlite3.connect(DATABASE_PATH) as connection:
        if expected_id is None:
            connection.execute(
                "INSERT INTO parties (id, record_json, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (party_id, json.dumps(stored), stored["createdAt"], stored["updatedAt"]),
            )
        else:
            connection.execute(
                "UPDATE parties SET record_json = ?, updated_at = ? WHERE id = ?",
                (json.dumps(stored), stored["updatedAt"], party_id),
            )
        connection.commit()
    return stored


initialize_database()


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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Accept", "Content-Type", "X-Companies-House-Api-Key"],
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
    "/api/parties",
    response_model=PartyListResponse,
    tags=["parties"],
)
async def list_parties() -> PartyListResponse:
    return PartyListResponse(items=read_party_rows())


@app.get(
    "/api/parties/{party_id}",
    response_model=dict[str, Any],
    tags=["parties"],
)
async def get_party(party_id: str) -> dict[str, Any]:
    party = read_party(party_id)
    if party is None:
        raise HTTPException(status_code=404, detail="Party not found.")
    return party


@app.post(
    "/api/parties",
    response_model=dict[str, Any],
    status_code=201,
    tags=["parties"],
)
async def create_party(party: PartyRecord) -> dict[str, Any]:
    if read_party(party.id) is not None:
        raise HTTPException(status_code=409, detail="A Party with this ID already exists.")
    return write_party(party.model_dump())


@app.put(
    "/api/parties/{party_id}",
    response_model=dict[str, Any],
    tags=["parties"],
)
async def update_party(party_id: str, party: PartyRecord) -> dict[str, Any]:
    if read_party(party_id) is None:
        raise HTTPException(status_code=404, detail="Party not found.")
    return write_party(party.model_dump(), expected_id=party_id)


@app.delete(
    "/api/parties/{party_id}",
    response_model=dict[str, Any],
    tags=["parties"],
)
async def delete_party(party_id: str) -> dict[str, Any]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        cursor = connection.execute("DELETE FROM parties WHERE id = ?", (party_id,))
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Party not found.")
    return {"id": party_id, "deleted": True}


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
