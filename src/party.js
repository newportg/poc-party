/* Browser-native Party domain model; also exported for dependency-free Node tests. */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.PartyModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "poc-party.records.v1";
  const TYPES = ["individual", "company", "group"];
  const STATUSES = ["Active", "Inactive", "Archived"];
  const samples = [
    {
      id: "PTY-1001", type: "individual", status: "Active", displayName: "Avery Morgan",
      givenNames: "Avery", familyName: "Morgan", dateOfBirth: "1987-04-12", nationality: "British",
      createdAt: "2026-10-12T09:00:00.000Z", updatedAt: "2026-10-12T09:00:00.000Z",
      participations: [{ matterId: "MAT-2048", matterName: "Riverside refinancing", role: "Joint purchaser" }]
    },
    {
      id: "PTY-1002", type: "individual", status: "Active", displayName: "Jordan Lee",
      givenNames: "Jordan", familyName: "Lee", dateOfBirth: "", nationality: "",
      createdAt: "2026-10-12T09:05:00.000Z", updatedAt: "2026-10-12T09:05:00.000Z",
      participations: [{ matterId: "MAT-2048", matterName: "Riverside refinancing", role: "Director" }]
    },
    {
      id: "PTY-1003", type: "company", status: "Active", displayName: "Harbour Homes Limited",
      legalName: "Harbour Homes Limited", tradingName: "Harbour Homes", legalForm: "Private limited company",
      registrationNumber: "DEMO-771204", jurisdiction: "United Kingdom",
      createdAt: "2026-10-10T11:00:00.000Z", updatedAt: "2026-10-10T11:00:00.000Z",
      participations: [{ matterId: "MAT-2048", matterName: "Riverside refinancing", role: "Borrower" }]
    },
    {
      id: "PTY-1004", type: "company", status: "Active", displayName: "Quay Street Ventures Ltd",
      legalName: "Quay Street Ventures Ltd", tradingName: "", legalForm: "Private limited company",
      registrationNumber: "", jurisdiction: "United Kingdom",
      createdAt: "2026-10-08T11:00:00.000Z", updatedAt: "2026-10-08T11:00:00.000Z",
      participations: []
    },
    {
      id: "PTY-1005", type: "group", status: "Active", displayName: "Riverside Joint Purchasers",
      createdAt: "2026-10-14T08:30:00.000Z", updatedAt: "2026-10-15T10:00:00.000Z",
      memberships: [
        { id: "MEM-1", memberId: "PTY-1001", role: "Joint purchaser", from: "2026-10-14", to: "", status: "Active" },
        { id: "MEM-2", memberId: "PTY-1003", role: "Corporate purchaser", from: "2026-10-14", to: "", status: "Active" },
        { id: "MEM-3", memberId: "PTY-1002", role: "Former representative", from: "2025-02-01", to: "2026-01-31", status: "Ended" }
      ],
      participations: [{ matterId: "MAT-2048", matterName: "Riverside refinancing", role: "Purchaser group" }]
    },
    {
      id: "PTY-1006", type: "individual", status: "Inactive", displayName: "Casey Taylor",
      givenNames: "Casey", familyName: "Taylor", dateOfBirth: "", nationality: "",
      createdAt: "2025-03-20T08:00:00.000Z", updatedAt: "2026-02-01T08:00:00.000Z",
      participations: []
    }
  ];

  const clone = value => JSON.parse(JSON.stringify(value));
  function getSampleParties() { return clone(samples); }
  function getActiveMemberships(group) {
    return (group && group.type === "group" ? group.memberships || [] : [])
      .filter(membership => membership.status === "Active");
  }
  function isDate(value) {
    if (!value) return true;
    if (typeof value !== "string" || !/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) return false;
    const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
  }
  function validateParty(party, parties = [], editingId = "") {
    const errors = [];
    if (!party || typeof party !== "object") return ["Enter Party details."];
    if (!TYPES.includes(party.type)) errors.push("Choose an individual, company, or group type.");
    if (!party.displayName || !party.displayName.trim()) errors.push("Enter a display name.");
    if (!STATUSES.includes(party.status)) errors.push("Choose a valid record status.");
    if (party.id && parties.some(item => item.id.toLowerCase() === party.id.toLowerCase() && item.id !== editingId)) {
      errors.push("That stable Party identifier is already in use.");
    }
    if (party.type === "individual" && (!party.givenNames || !party.givenNames.trim()) && (!party.familyName || !party.familyName.trim())) {
      errors.push("Enter at least one name component for the individual.");
    }
    if (party.type === "company" && party.legalName && !party.legalName.trim()) errors.push("Legal name cannot contain only spaces.");
    if (party.type === "group") {
      const members = party.memberships || [];
      const activeIds = new Set();
      for (const membership of members) {
        if (!["Active", "Ended"].includes(membership.status)) errors.push("Each membership must be Active or Ended.");
        if (membership.from && !isDate(membership.from)) errors.push("Membership start date must be a valid date.");
        if (membership.to && !isDate(membership.to)) errors.push("Membership end date must be a valid date.");
        if (membership.from && membership.to && membership.to < membership.from) errors.push("Membership end date cannot be before its start date.");
        const member = parties.find(item => item.id === membership.memberId);
        if (!member) errors.push("Every membership must refer to an existing Party.");
        else if (member.type !== "individual" && member.type !== "company") errors.push("Groups may include only individual or company Parties.");
        if (membership.memberId === party.id && membership.status === "Active") errors.push("A group cannot be its own member.");
        if (membership.status === "Active" && membership.memberId) {
          if (activeIds.has(membership.memberId)) errors.push("A duplicate active group membership is not allowed.");
          activeIds.add(membership.memberId);
        }
      }
      const participations = party.participations || [];
      if (participations.length && getActiveMemberships(party).length === 0) {
        errors.push("A group needs at least one active member before it can participate in a matter.");
      }
    }
    for (const participation of party.participations || []) {
      if (!participation.matterId || !participation.matterId.trim()) errors.push("Each matter reference needs a matter ID.");
      if (!participation.role || !participation.role.trim()) errors.push("Each matter participation needs a context-specific role.");
    }
    return [...new Set(errors)];
  }
  function searchParties(parties, query = "", type = "", status = "") {
    const needle = query.trim().toLocaleLowerCase();
    return parties.filter(party => {
      const memberships = (party.memberships || []).map(m => {
        const member = parties.find(item => item.id === m.memberId);
        return [m.memberId, m.role, member && member.displayName].join(" ");
      });
      const participations = (party.participations || []).flatMap(m => [m.matterId, m.matterName, m.role]);
      const searchable = [party.id, party.displayName, party.type, party.givenNames, party.familyName,
        party.legalName, party.tradingName, party.registrationNumber, party.jurisdiction, ...memberships, ...participations]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return (!needle || searchable.includes(needle)) && (!type || party.type === type) && (!status || party.status === status);
    });
  }
  return {
    STORAGE_KEY, TYPES, STATUSES, getSampleParties, getActiveMemberships,
    validateParty, searchParties
  };
});
