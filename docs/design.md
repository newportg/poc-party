# Party Explorer implementation design

This static proof of concept demonstrates the Party concepts described in the
knowledge-vault Party PRD and individual/company domain notes:
[vault Party project](file:///C:/Source/Obsidian/Projects/POC-Documentation/POC-Documentation-Vault/projects/Party/README.md).

## Implemented model

- A Party has a stable demo ID, one immutable type (`individual`, `company`, or
  `group`), a display name, status, and created/updated timestamps.
- Individual and company attributes are kept on their Party record. Optional details
  are sparse; these demo fields are not a production data contract.
- Group membership is a distinct, effective-dated link with a group-specific optional
  role. MVP groups can contain only individual or company Parties; they cannot nest.
  Ending a membership retains the relationship row with `Ended` status.
- A group may exist without active members, but cannot be referenced by a matter unless
  it has at least one active member.
- Matter participation is a separate `{ matterId, matterName, role }` reference on a
  Party. A role is contextual and does not change the identity record.

## Runtime and data flow

`src/index.html` loads browser-native `src/party.js` (domain rules/sample data) and
`src/app.js` (rendering, form interactions, and storage). The app renders into the DOM
and persists the complete fictional collection under `poc-party.records.v1` in
`localStorage`. The reset action replaces it with the original sample set. It makes no
automatic network requests until a Company search is explicitly requested. Selecting
Company as the Party type copies the display name into the legal-name and Companies
House search fields; editing a Company display name keeps those fields in sync. The
lookup panel calls the configured URL in `src/config.js`. The Azure Functions proxy
adds the server-side API key, validates the search, limits results, and forwards the
Companies House JSON response. The key is configured as a Function App setting and is
never sent to the browser. The frontend shows the proxy request and escaped response
JSON. Selecting a register result does not constitute legal verification. The
unauthenticated proxy endpoint is publicly callable; CORS is not access control, so a
production deployment should add rate limiting. `src/openapi.html` is an interactive
Swagger UI page for the OpenAPI 3 document served at `/api/openapi.json`; its Try it out
requests go to the deployed proxy endpoint.

## Validation boundaries

Focused tests exercise required identity fields, unique IDs, Party types/status,
valid group-member types, duplicate/self membership rejection, effective date order,
active-member requirement for group participation, contextual matter roles, search,
filters, and active-vs-ended membership behavior.

## Limitations and security

This is a non-production demonstration. Browser-local storage is not encrypted or
shared, and is user-editable. There is no authentication, authorization, server-side
validation, audit trail, retention enforcement, identity matching, merge workflow,
screening, verification, or compliance logic. Timestamps are illustrative client-side
metadata, not attributed audit events. Do not enter real personal or company data.
