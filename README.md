# Party Explorer — static proof of concept

A browser-native demonstration of reusable Party records: individuals, companies,
groups, group membership, and matter participation. This is a standalone prototype;
it has no server, build step, dependencies, external requests, or authoritative data.

## Run

Open [`src/index.html`](src/index.html) directly in a modern browser. All app scripts
are classic browser JavaScript so the page works from a local file without a server.
No install or build is required.

Edits are stored in this browser's `localStorage`. Use **Reset sample data** to remove
local changes and restore the included fictional records. Storage is not shared,
secure, backed up, or suitable for production data.

## What is included

- Search by Party ID, name, membership, and matter reference; filter by type and status.
- Individual, company, and group details with create/edit interactions and validation.
- Stable Party IDs; type is fixed after a record is created.
- Explicit group membership for individual/company Parties, optional roles and dates,
  active and ended history, and validation against duplicates, invalid targets, and
  invalid date ranges.
- Matter participation roles attached to matter references, not Party identity.
- Resettable local sample data and clear demo-only security and privacy caveats.

All records are fictional. Authorization, audit, retention, identity matching,
screening, verification, and compliance controls are not implemented. Do not enter
real personal or company information.

## Project links

- Knowledge-vault project: [Party](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Party/README.md)
- Requirements and domain discovery: vault `projects/Party/` (`party-prd.md`, `individual-model.md`, `company-model.md`)
- Implementation design and limitations: [`docs/design.md`](docs/design.md)

## Validation

Focused, dependency-free tests: `node --test tests/party.test.cjs`
