# Party Explorer — static proof of concept

A browser-native demonstration of reusable Party records: individuals, companies,
groups, group membership, and matter participation. This is a standalone prototype;
it has no server, build step, dependencies, or authoritative data. Company search makes
an HTTPS request to the Companies House API only when explicitly started by the user.

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
  shown after search alongside the JSON response; the authorization value is masked.
- Stable Party IDs; type is fixed after a record is created.
- Explicit group membership for individual/company Parties, optional roles and dates,
  active and ended history, and validation against duplicates, invalid targets, and
  invalid date ranges.
- Matter participation roles attached to matter references, not Party identity.
- Resettable local sample data, persistent light/dark theme preference, and clear
  demo-only security and privacy caveats.

Sample records are fictional; company search uses public Companies House data. The API
key is sent directly to Companies House over HTTPS and is not saved by this app, but a
browser-based app cannot keep it secret. Use only on a trusted device; do not use
shared or public computers. Selecting a search result is not legal verification.
Authorization, audit, retention, identity matching, screening, verification, and
compliance controls are not implemented. Do not enter personal or confidential
information.

## Project links

- Knowledge-vault project: [Party](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Party/README.md)
- Requirements and domain discovery: vault `projects/Party/` (`party-prd.md`, `individual-model.md`, `company-model.md`)
- Implementation design and limitations: [`docs/design.md`](docs/design.md)

## Validation

Focused, dependency-free tests: `node --test tests/party.test.cjs`
