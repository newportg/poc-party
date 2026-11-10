# Party Explorer — static proof of concept

A browser-native demonstration of reusable Party records: individuals, companies,
groups, group membership, and matter participation. The frontend is a static site
without a build step or authoritative data. An optional Azure Functions proxy handles
Companies House searches so the API key remains server-side.

## Run

Open [`src/index.html`](src/index.html) directly in a modern browser. All app scripts
are classic browser JavaScript so the page works from a local file without a server.
No install or build is required. Company lookup stays disabled until an Azure Function
URL is configured in [`src/config.js`](src/config.js); follow
[`api/README.md`](api/README.md) to run the proxy locally.

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
  panel, then select a result to populate the display name and company details. Search
  uses the Azure Function proxy documented in [`api/README.md`](api/README.md); the
  Companies House key is stored in the Function App settings, not in this site.
- Browse and try the proxy API from the interactive [OpenAPI page](src/openapi.html) after
  configuring the deployed function URL in `src/config.js`.
- Stable Party IDs; type is fixed after a record is created.
- Explicit group membership for individual/company Parties, optional roles and dates,
  active and ended history, and validation against duplicates, invalid targets, and
  invalid date ranges.
- Matter participation roles attached to matter references, not Party identity.
- Resettable local sample data, persistent light/dark theme preference, and clear
  demo-only security and privacy caveats.

Sample records are fictional; company search uses public Companies House data. The
proxy endpoint is publicly callable so this static site can use it; CORS is not
authentication. Add rate limiting before exposing it broadly. Selecting a search
result is not legal verification.
Authorization, audit, retention, identity matching, screening, verification, and
compliance controls are not implemented. Do not enter personal or confidential
information.

## Project links

- Knowledge-vault project: [Party](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Party/README.md)
- Requirements and domain discovery: vault `projects/Party/` (`party-prd.md`, `individual-model.md`, `company-model.md`)
- Implementation design and limitations: [`docs/design.md`](docs/design.md)
- Azure Functions proxy setup: [`api/README.md`](api/README.md)

## Validation

Run the frontend and proxy tests with
`node --test tests/party.test.cjs api/test/proxy.test.cjs`.
