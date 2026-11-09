const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/party.js");

const individual = {
  id: "PTY-9001", type: "individual", status: "Active", displayName: "Riley Example",
  givenNames: "Riley", familyName: "Example", participations: []
};
const company = {
  id: "PTY-9002", type: "company", status: "Active", displayName: "Example Works Ltd",
  legalName: "Example Works Ltd", participations: []
};
const group = {
  id: "PTY-9003", type: "group", status: "Active", displayName: "Example group",
  memberships: [{ id: "MEM-X", memberId: individual.id, role: "Member", from: "2025-01-01", to: "", status: "Active" }],
  participations: []
};

test("fictional samples use unique stable IDs and valid Party types", () => {
  const parties = M.getSampleParties();
  assert.equal(new Set(parties.map(party => party.id)).size, parties.length);
  assert.ok(parties.some(party => party.type === "individual"));
  assert.ok(parties.some(party => party.type === "company"));
  assert.ok(parties.some(party => party.type === "group"));
  for (const party of parties) assert.deepEqual(M.validateParty(party, parties, party.id), []);
});

test("valid individual, company, and group records pass validation", () => {
  assert.deepEqual(M.validateParty(individual), []);
  assert.deepEqual(M.validateParty(company), []);
  assert.deepEqual(M.validateParty(group, [individual, company, group], group.id), []);
});

test("required identity, type, status, and duplicate identifier are validated", () => {
  assert.ok(M.validateParty({ ...individual, displayName: "" }).some(error => error.includes("display name")));
  assert.ok(M.validateParty({ ...individual, givenNames: "", familyName: "" }).some(error => error.includes("name component")));
  assert.ok(M.validateParty({ ...individual, type: "other" }).some(error => error.includes("type")));
  assert.ok(M.validateParty({ ...individual, status: "Unknown" }).some(error => error.includes("status")));
  assert.ok(M.validateParty({ ...individual }, [{ ...individual, id: "pty-9001" }]).some(error => error.includes("already in use")));
});

test("membership accepts individual and company members but rejects group links and missing parties", () => {
  const groupParty = { ...group, memberships: [{ memberId: company.id, role: "Corporate member", from: "", to: "", status: "Active" }] };
  assert.deepEqual(M.validateParty(groupParty, [individual, company, groupParty], groupParty.id), []);
  const nested = { ...groupParty, memberships: [{ memberId: "PTY-GROUP", status: "Active" }] };
  assert.ok(M.validateParty(nested, [{ id: "PTY-GROUP", type: "group" }, nested], nested.id).some(error => error.includes("only individual or company")));
  assert.ok(M.validateParty({ ...groupParty, memberships: [{ memberId: "MISSING", status: "Active" }] }, [individual], groupParty.id).some(error => error.includes("existing Party")));
});

test("self links, duplicate active memberships, and invalid effective dates are rejected", () => {
  assert.ok(M.validateParty({ ...group, memberships: [{ memberId: group.id, status: "Active" }] }, [group], group.id).some(error => error.includes("own member")));
  const duplicate = { ...group, memberships: [{ memberId: individual.id, status: "Active" }, { memberId: individual.id, status: "Active" }] };
  assert.ok(M.validateParty(duplicate, [individual, duplicate], duplicate.id).some(error => error.includes("duplicate active")));
  const reversed = { ...group, memberships: [{ memberId: individual.id, from: "2025-04-01", to: "2025-03-01", status: "Active" }] };
  assert.ok(M.validateParty(reversed, [individual, reversed], reversed.id).some(error => error.includes("before its start")));
  const impossibleDate = { ...group, memberships: [{ memberId: individual.id, from: "2025-02-31", status: "Active" }] };
  assert.ok(M.validateParty(impossibleDate, [individual, impossibleDate], impossibleDate.id).some(error => error.includes("valid date")));
});

test("groups with no active members cannot be referenced by a matter", () => {
  const empty = { ...group, memberships: [], participations: [{ matterId: "MAT-1", role: "Purchaser" }] };
  assert.ok(M.validateParty(empty, [empty], empty.id).some(error => error.includes("at least one active member")));
  const inactive = { ...group, memberships: [{ memberId: individual.id, status: "Ended" }], participations: [{ matterId: "MAT-1", role: "Purchaser" }] };
  assert.ok(M.validateParty(inactive, [individual, inactive], inactive.id).some(error => error.includes("at least one active member")));
});

test("matter participation requires a matter reference and contextual role", () => {
  assert.deepEqual(M.validateParty({ ...individual, participations: [{ matterId: "MAT-1", role: "Buyer" }] }), []);
  assert.ok(M.validateParty({ ...individual, participations: [{ matterId: "", role: "Buyer" }] }).some(error => error.includes("matter ID")));
  assert.ok(M.validateParty({ ...individual, participations: [{ matterId: "MAT-1", role: "" }] }).some(error => error.includes("context-specific role")));
});

test("search covers identifiers, names, member names, matter references, type and status filters", () => {
  const parties = M.getSampleParties();
  assert.deepEqual(M.searchParties(parties, "PTY-1001").map(party => party.id).sort(), ["PTY-1001", "PTY-1005"]);
  assert.equal(M.searchParties(parties, "Jordan Lee").length, 2); // individual plus group membership history
  assert.equal(M.searchParties(parties, "MAT-2048", "group")[0].id, "PTY-1005");
  assert.equal(M.searchParties(parties, "", "company").length, 2);
  assert.equal(M.searchParties(parties, "", "", "Inactive").length, 1);
});

test("Companies House API search sends the name and Basic-authenticated key", async () => {
  let request;
  const expectedItems = [{ title: "ACME & SONS LTD", company_number: "01234567" }];
  let responseBody;
  const items = await M.searchCompaniesHouse(
    "  Acme & Sons Ltd  ", " test-key ",
    async (url, options) => {
      request = { url: new URL(url), options };
      return { ok: true, json: async () => ({ items: expectedItems }) };
    },
    data => { responseBody = data; }
  );
  assert.equal(request.url.origin, "https://api.company-information.service.gov.uk");
  assert.equal(request.url.protocol, "https:");
  assert.equal(request.url.pathname, "/search/companies");
  assert.equal(M.companiesHouseSearchUrl("  Acme & Sons Ltd  "), request.url.href);
  assert.equal(request.url.searchParams.get("q"), "Acme & Sons Ltd");
  assert.equal(request.url.searchParams.get("items_per_page"), "10");
  assert.equal(request.options.headers.Authorization, `Basic ${Buffer.from("test-key:").toString("base64")}`);
  assert.equal(request.options.headers.Accept, "application/json");
  assert.deepEqual(items, expectedItems);
  assert.deepEqual(responseBody, { items: expectedItems });
});

test("Companies House request URL rejects an empty search term", () => {
  assert.throws(() => M.companiesHouseSearchUrl("  "), /company name/);
});

test("Companies House API search reports missing input and rejected credentials", async () => {
  await assert.rejects(M.searchCompaniesHouse("", "api-key", async () => {}), /company name/);
  await assert.rejects(M.searchCompaniesHouse("Acme Ltd", "", async () => {}), /API key/);
  await assert.rejects(
    M.searchCompaniesHouse("Acme Ltd", "bad-key", async () => ({ ok: false, status: 401 })),
    /rejected the API key/
  );
});

test("active membership helper excludes ended history", () => {
  const sampleGroup = M.getSampleParties().find(party => party.type === "group");
  assert.equal(M.getActiveMemberships(sampleGroup).length, 2);
  assert.ok(sampleGroup.memberships.some(membership => membership.status === "Ended"));
});
