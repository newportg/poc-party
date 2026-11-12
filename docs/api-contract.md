# POC Party Companies House API Contract

The API is an optional FastAPI proxy for Companies House company search. The
default local base URL is `http://127.0.0.1:8000`.

The proxy does not persist or expose the caller's Companies House API key.

## `GET /`

Response:

```json
{"service": "Companies House Proxy API", "docs": "/docs"}
```

## `GET /health`

Response:

```json
{"status": "ok"}
```

## `GET /heartbeat`

Response:

```json
{"status": "awake"}
```

This lightweight endpoint can be called when the client starts to wake a
sleeping hosted service.

## `GET /api/companies/search`

Headers:

```http
Accept: application/json
X-Companies-House-Api-Key: <caller Companies House API key>
```

Query parameters:

| Parameter | Required | Rules |
|---|---:|---|
| `q` | yes | Company name; 1-160 characters after trimming |

Example:

```http
GET /api/companies/search?q=ACME%20LTD
X-Companies-House-Api-Key: caller-key
```

The proxy forwards the request to the Companies House search endpoint with
`items_per_page=10` and Basic authentication using the caller's key as the
username and an empty password.

Response:

```json
{
  "items": [
    {
      "title": "ACME LTD",
      "company_number": "01234567",
      "company_status": "active"
    }
  ],
  "total_results": 1,
  "items_per_page": 10,
  "start_index": 0
}
```

The response preserves additional Companies House fields. Only `items` is
required; the pagination fields are returned when supplied by Companies House.

## Interactive documentation

FastAPI publishes the interactive OpenAPI UI at `/docs` and the schema at
`/openapi.json`.

## Errors

FastAPI validation responses (`422`) are used for missing or invalid query and
header values. Other proxy errors include:

| Status | Meaning |
|---:|---|
| `401` | Companies House rejected the API key |
| `502` | Companies House could not be reached, returned invalid JSON, or returned an unexpected response |
| `504` | Companies House request timed out |

Error bodies use:

```json
{"detail": "A human-readable message"}
```

Messages must not echo the API key.

## Direct browser lookup

When no proxy URL is configured, the browser can call Companies House directly.
The built-in case-insensitive query `zoomalong limited` uses a local mock and
does not make a network request or require an API key. Other direct requests
require an API key and report network/access failures separately from rejected
credentials and rate limits.
