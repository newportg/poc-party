# Party Explorer Recreation Specification

This specification describes how to recreate the Party Explorer POC without
access to the original source. The main application is a browser-native static
page; the API is optional and only proxies Companies House searches.

## Runtime files

```text
src/index.html             Application shell and page layout
src/app.js                 Rendering, editing, persistence, and UI state
src/party.js               Party fixtures, validation, search, and API helpers
src/config.js              Optional Companies House proxy URL
src/documentation.html     In-app documentation
src/documentation.css      Documentation page styles
api/main.py                Optional FastAPI proxy
scripts/run-local.ps1      Local API/client startup
tests/party.test.cjs       Focused model and API behavior tests
```

No frontend build step or database is required. The static page works directly
from a local file.

## Data and storage

Store the editable catalogue under `poc-party.records.v1` in browser
`localStorage`. Store the theme under `poc-party.theme.v1`. The reset action
restores the fictional sample records.

Every Party has a stable ID, type, status, display name, timestamps,
memberships, and matter participations. Types are Individual, Company, and
Group. Individuals have person fields; companies have legal and registration
fields; groups have effective-dated membership links.

Groups may contain only individuals or companies, not groups. Memberships retain
Active and Ended history. Matter participation is contextual and stores matter
ID, matter name, and role on the Party record.

## UI behavior

The page contains:

- searchable Party catalogue;
- type and status filters;
- selected Party detail panel;
- create/edit Party dialog;
- membership and matter-reference sections;
- company lookup panel;
- detail-pane zoom from 80% to 140%;
- light/dark theme toggle;
- reset sample-data action.

Search covers Party ID, display/name fields, member ID/name/role, and matter
references. Selecting a catalogue entry updates the detail panel. Company
search results can populate company name, registration, legal form,
jurisdiction, status, and dissolution data.

The built-in case-insensitive query `zoomalong limited` returns the mock
Companies House response without a network request or API key.

## Company search and API

When `window.PARTY_API_BASE_URL` is configured, request:

```http
GET /api/companies/search?q=<company name>
X-Companies-House-Api-Key: <caller key>
```

The proxy forwards the key to Companies House using Basic authentication and
does not persist it. It exposes `/`, `/health`, `/heartbeat`,
`/api/companies/search`, `/docs`, and `/openapi.json`.

The browser also supports direct Companies House lookup when no proxy URL is
configured. Invalid keys, rate limits, and network/access failures must be
reported distinctly.

## Validation and tests

Validate required display name, type, status, unique IDs, individual names,
membership target types, membership date ordering, duplicate active members,
self-membership, matter reference IDs, roles, and active-member requirements
for participating groups.

Run:

```powershell
node --test tests/party.test.cjs
cd api
python -m unittest -v
```

## Limitations

There is no authentication, authorization, production database, audit trail,
retention enforcement, identity matching, screening, compliance workflow, or
secure client secret storage. All records are fictional demo data. Do not enter
real personal or confidential information.
