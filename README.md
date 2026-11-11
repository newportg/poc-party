# Party Explorer — static proof of concept

A browser-native demonstration of reusable Party records: individuals, companies,
groups, group membership, and matter participation. The browser app is a standalone
prototype; company search makes an HTTPS request only when explicitly started by the
user. An optional Python service proxies Companies House requests and can be hosted on
Render.

## Run

Open [`src/index.html`](src/index.html) directly in a modern browser. All app scripts
are classic browser JavaScript so the page works from a local file without a server.
No install or build is required.

## Publish with GitHub Pages

The **Publish GitHub Pages** workflow deploys the static app from `src/` when changes
are pushed to `master`, or when manually started from the Actions tab. In the
repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
The deployment URL is available in the workflow run summary and the `github-pages`
environment.

Edits are stored in this browser's `localStorage`. Use **Reset sample data** to remove
local changes and restore the included fictional records. Storage is not shared,
secure, backed up, or suitable for production data.

## What is included

- Search by Party ID, name, membership, and matter reference; filter by type and status.
- Adjust detail pane zoom from 80% to 140% without changing the catalogue or overall
  page zoom.
- Individual, company, and group details with create/edit interactions and validation.
- Choosing Company as the Party type copies the display name to the legal name and
  Companies House search fields; typing a display name for a Company keeps them in sync.
- For Company records, search the Companies House REST API using the company lookup
  panel, then select a result to populate the display name and company details. Enter
  an API key in the panel to enable search. The request method, URL, and headers are
  shown after search alongside the JSON response; the API key is masked.
- Searching for `zoomalong limited` returns the built-in mock Companies House response
  without making a network request or requiring an API key. The mock matches the name
  case-insensitively and is not a live Companies House result. Other company names use
  the live API search.
- Company search results show any returned dissolution date. Selecting a result maps
  its Companies House status to the Party record status: active → Active, dissolved →
  Archived, and other non-empty statuses → Inactive.
- If search reports a network or access block, check the browser's connection,
  extensions, and firewall. An invalid API key is reported separately as HTTP 401.
- Stable Party IDs; type is fixed after a record is created.
- Explicit group membership for individual/company Parties, optional roles and dates,
  active and ended history, and validation against duplicates, invalid targets, and
  invalid date ranges.
- Matter participation roles attached to matter references, not Party identity.
- Resettable local sample data, persistent light/dark theme preference, and clear
  demo-only security and privacy caveats.

Sample records are fictional; company search uses public Companies House data. The API
key is sent to the configured service over HTTPS, then forwarded to Companies House;
it is not saved by the app or service, but a browser-based app cannot keep it secret.
Use only on a trusted device; do not use shared or public computers. Selecting a
search result is not legal verification.
Authorization, audit, retention, identity matching, screening, verification, and
compliance controls are not implemented. Do not enter personal or confidential
information.

## Companies House service on Render

The optional FastAPI service in `api/` provides `/api/companies/search`, `/health`,
`/heartbeat`, and generated OpenAPI documentation at `/docs` and `/openapi.json`.
The client sends its Companies House API key in the
`X-Companies-House-Api-Key` header; the service forwards it to Companies House using
Basic authentication. The key is not stored by the service.

1. In Render, create a Blueprint from this repository and use the included
   `render.yaml`, or create a Python web service with `api/` as its root directory.
2. Set `CORS_ORIGINS` to the exact origin(s) where the static app is hosted, separated
   by commas. For example, a GitHub Pages site has an origin like
   `https://<owner>.github.io`. The service defaults to `*` if this variable is unset.
3. In the Render service settings, create a deploy hook. In GitHub, add a repository
   Actions secret named `RENDER_DEPLOY_HOOK_URL` with that hook URL. Disable Render's
   automatic Git deployments to avoid deploying the same commit twice. The
   **Deploy Companies House API to Render** workflow runs the API tests and calls the
   deploy hook on pushes to `master` that change `api/`, `render.yaml`, or the workflow
   itself; it can also be started manually from the Actions tab. Configure secrets
   under **Settings → Secrets and variables → Actions**.
4. After deployment, set `window.PARTY_API_BASE_URL` in `src/config.js` to the
   service's base URL, such as `https://companies-house-proxy.onrender.com`.
5. Publish the updated static app. On startup it calls `/heartbeat` to wake the Render
   service; subsequent live company searches use the proxy. The Companies House key
   remains client-supplied and is sent only when the user explicitly searches.

If `PARTY_API_BASE_URL` is empty, the app retains its existing direct-to-Companies
House search behavior. A Render service that has spun down may take time to respond
to its first request.

Run the API from the `api/` directory with `pip install -r requirements.txt` and
`uvicorn main:app --reload`. Run its focused tests with `python -m unittest -v`.

## Project links

- Knowledge-vault project: [Party](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Party/README.md)
- Requirements and domain discovery: vault `projects/Party/` (`party-prd.md`, `individual-model.md`, `company-model.md`)
- Implementation design and limitations: [`docs/design.md`](docs/design.md)

## Validation

Focused frontend tests: `node --test tests/party.test.cjs`. API tests:
`cd api && python -m unittest -v`.
