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

## Run the API and client locally with Podman

Install Podman Desktop and Node.js, then run this from PowerShell in the repository:

```powershell
.\scripts\run-local.ps1
```

The script builds and starts the API container, serves a temporary copy of the client
configured to use the local API, and opens it in your browser. The repository's
`src/config.js` is left unchanged, and the local API listens on loopback only. Press
Enter in the script window to stop the container and local client server. To use
different ports, pass `-ApiPort` and
`-ClientPort`, for example `.\scripts\run-local.ps1 -ApiPort 8001 -ClientPort 5174`.
If the default client port `5173` is already in use, the script automatically
selects the next available port.
The interactive company search still requires your Companies House API key.

The local runner rebuilds the published recreation documentation before serving
the temporary client. Run `.\scripts\publish-docs.ps1` directly to refresh it
without starting the local services. This publishes both the
[recreation specification](docs/recreation-spec.md) and
[Companies House API contract](docs/api-contract.md).

## Project links

- Knowledge-vault project: [Party](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Party/README.md)
- Requirements and domain discovery: vault `projects/Party/` (`party-prd.md`, `individual-model.md`, `company-model.md`)
- Implementation design and limitations: [`docs/design.md`](docs/design.md)
- Source-independent recreation guide: [`src/recreation-spec.md`](src/recreation-spec.md)

## Validation

Focused frontend tests: `node --test tests/party.test.cjs`. API tests:
`cd api && python -m unittest -v`.
