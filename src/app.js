(() => {
  "use strict";
  const M = window.PartyModel;
  const $ = selector => document.querySelector(selector);
  const list = $("#party-list");
  const detail = $("#detail-panel");
  const dialog = $("#party-dialog");
  const form = $("#party-form");
  const THEME_STORAGE_KEY = "poc-party.theme.v1";
  let parties = loadParties();
  let selectedId = parties[0]?.id || "";
  let detailZoom = 100;
  let toastTimer;
  let companySearchRequestId = 0;
  let companySearchInProgress = false;
  let companiesHouseResults = [];
  let lastCompanySearchName = "";
  let lastCompanyApiKey = "";

  function loadTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    } catch (error) {
      console.warn("Could not read the theme preference.", error);
      return "dark";
    }
  }
  function setTheme(theme, save = false) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    $("#theme-toggle").setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    $("#theme-toggle").title = `Switch to ${nextTheme} theme`;
    $("#theme-toggle .theme-icon").textContent = theme === "dark" ? "☼" : "☾";
    $("#theme-toggle .theme-label").textContent = theme === "dark" ? "Light" : "Dark";
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0a0a0f" : "#f5f6fa";
    if (!save) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Could not save the theme preference.", error);
      showToast("Theme changed, but the preference could not be saved.", "error");
    }
  }
  setTheme(loadTheme());

  function loadParties() {
    try {
      const saved = localStorage.getItem(M.STORAGE_KEY);
      if (!saved) return M.getSampleParties();
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every(item => item && typeof item.id === "string" && M.TYPES.includes(item.type))) return parsed;
    } catch (error) {
      console.warn("Could not read the local demo records.", error);
    }
    return M.getSampleParties();
  }
  function persist() {
    try {
      localStorage.setItem(M.STORAGE_KEY, JSON.stringify(parties));
      $("#reset-button").classList.remove("unsaved");
      return true;
    } catch (error) {
      showToast("Could not save. Browser storage may be unavailable or full.", "error");
      return false;
    }
  }
  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function showToast(message, kind = "success") {
    const toast = $("#toast");
    toast.textContent = message;
    toast.className = `toast visible ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = "toast"; }, 3200);
  }
  function initials(name = "") { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?"; }
  function labelType(type) { return ({ individual: "Individual", company: "Company", group: "Group" })[type] || type; }
  function activeCount(party) { return M.getActiveMemberships(party).length; }
  function renderList() {
    const filtered = M.searchParties(parties, $("#search-input").value, $("#type-filter").value, $("#status-filter").value);
    $("#record-count").textContent = `${parties.length} ${parties.length === 1 ? "Party" : "Parties"}`;
    $("#visible-count").textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;
    if (!filtered.some(party => party.id === selectedId)) selectedId = filtered[0]?.id || "";
    list.innerHTML = filtered.length ? filtered.map(party => `
      <li class="party-row ${party.id === selectedId ? "selected" : ""}" data-id="${escapeHtml(party.id)}" tabindex="0" role="button" aria-pressed="${party.id === selectedId}">
        <span class="party-avatar ${escapeHtml(party.type)}">${escapeHtml(initials(party.displayName))}</span>
        <span class="party-row-main"><strong>${escapeHtml(party.displayName)}</strong><small>${escapeHtml(party.id)} <span class="row-divider">·</span> ${escapeHtml(labelType(party.type))}${party.type === "group" ? ` · ${activeCount(party)} active` : ""}</small></span>
        <span class="status-dot ${escapeHtml(party.status.toLowerCase())}">${escapeHtml(party.status)}</span>
      </li>`).join("") : `<li class="list-empty"><span>⌕</span><strong>No matching Parties</strong><small>Try another search or clear a filter.</small></li>`;
    renderDetail();
  }
  function partyLink(party, caption = "") {
    return `<button class="text-link" data-open="${escapeHtml(party.id)}">${escapeHtml(party.displayName)}<small>${escapeHtml(party.id)}${caption ? ` · ${escapeHtml(caption)}` : ` · ${escapeHtml(labelType(party.type))}`}</small></button>`;
  }
  function info(label, value) {
    return `<div><span class="micro-label">${escapeHtml(label.toUpperCase())}</span><strong>${escapeHtml(value || "Not recorded")}</strong></div>`;
  }
  function renderDetail() {
    const party = parties.find(item => item.id === selectedId);
    if (!party) {
      detail.innerHTML = `<div class="detail-empty"><span class="empty-glyph">◈</span><h2>${parties.length ? "No Party selected" : "No records yet"}</h2><p>${parties.length ? "Choose a record from the catalogue." : "Create a Party or reset the sample data."}</p></div>`;
      return;
    }
    const memberships = party.type === "group" ? party.memberships || [] : [];
    const participations = party.participations || [];
    let identity = "";
    if (party.type === "individual") {
      identity = `<section class="info-card"><div class="card-title"><span class="card-icon">◉</span><div><h3>Individual details</h3><p>Optional person attributes</p></div></div><div class="data-grid">${info("Given names", party.givenNames)}${info("Family name", party.familyName)}${info("Date of birth", party.dateOfBirth)}${info("Nationality", party.nationality)}</div></section>`;
    } else if (party.type === "company") {
      identity = `<section class="info-card"><div class="card-title"><span class="card-icon green">▤</span><div><h3>Company details</h3><p>Descriptive organization attributes</p></div></div><div class="data-grid">${info("Legal name", party.legalName)}${info("Trading name", party.tradingName)}${info("Legal form", party.legalForm)}${info("Registration reference", party.registrationNumber)}${info("Jurisdiction", party.jurisdiction)}</div></section>`;
    } else {
      identity = `<section class="info-card"><div class="card-title"><span class="card-icon violet">◇</span><div><h3>Group identity</h3><p>A group is an addressable Party in its own right</p></div></div><div class="data-grid">${info("Active members", String(activeCount(party)))}${info("Membership history", `${memberships.length} links`)}</div></section>`;
    }
    const memberRows = memberships.length ? memberships.map(membership => {
      const member = parties.find(item => item.id === membership.memberId);
      if (!member) return `<article class="connection-card"><span class="history-tag">Unresolved member ${escapeHtml(membership.memberId)}</span></article>`;
      return `<article class="connection-card"><span class="connection-glyph">${membership.status === "Active" ? "↔" : "↶"}</span>${partyLink(member)}<span class="connection-meta"><b>${escapeHtml(membership.role || "Role not recorded")}</b><small>${escapeHtml(membership.from || "Start not recorded")} → ${escapeHtml(membership.to || (membership.status === "Active" ? "Present" : "End not recorded"))}</small></span><span class="history-tag">${escapeHtml(membership.status)}</span></article>`;
    }).join("") : `<p class="empty-note">No group memberships recorded.</p>`;
    const participationRows = participations.length ? participations.map(ref => `
      <article class="participation-card"><span class="matter-ref">${escapeHtml(ref.matterId)}</span><div><strong>${escapeHtml(ref.matterName || "Matter name not recorded")}</strong><small>Participation role · ${escapeHtml(ref.role)}</small></div></article>`).join("") : `<p class="empty-note">No matter references recorded. Roles are contextual and are not stored on Party identity.</p>`;
    const memberCount = memberships.length;
    detail.innerHTML = `
      <div class="detail-topline">
        <span class="record-label">PARTY RECORD <span>/</span> ${escapeHtml(party.id)}</span>
        <div class="detail-actions">
          <div class="detail-zoom" role="group" aria-label="Detail pane zoom">
            <button class="button button-quiet zoom-button" type="button" data-zoom="out" aria-label="Zoom out detail pane">−</button>
            <button class="button button-quiet zoom-value" type="button" data-zoom="reset" aria-label="Reset detail pane zoom to 100 percent">${detailZoom}%</button>
            <button class="button button-quiet zoom-button" type="button" data-zoom="in" aria-label="Zoom in detail pane">+</button>
          </div>
          <button class="button button-outline" id="edit-button" type="button">✎ &nbsp;Edit record</button>
        </div>
      </div>
      <div class="detail-zoom-content">
      <div class="detail-title"><span class="detail-avatar ${escapeHtml(party.type)}">${escapeHtml(initials(party.displayName))}</span>
        <div class="title-copy"><div class="eyebrow">${escapeHtml(labelType(party.type).toUpperCase())} <span class="footer-dot">/</span> STABLE IDENTITY</div><h2>${escapeHtml(party.displayName)}</h2><p>${escapeHtml(party.id)} <span class="row-divider">·</span> Type is fixed after creation</p></div>
        <span class="status-badge ${escapeHtml(party.status.toLowerCase())}"><i></i>${escapeHtml(party.status)}</span>
      </div>
      <nav class="tabs" aria-label="Party details"><button class="tab active" data-tab="overview">Overview</button>${party.type === "group" ? `<button class="tab" data-tab="members">Membership <span>${memberCount}</span></button>` : ""}<button class="tab" data-tab="references">Matter references <span>${participations.length}</span></button></nav>
      <div class="tab-content active" data-panel="overview"><div class="content-grid">${identity}
        <section class="info-card"><div class="card-title"><span class="card-icon violet">⌁</span><div><h3>Record metadata</h3><p>Demo timestamps</p></div></div><div class="data-grid">${info("Created", party.createdAt)}${info("Updated", party.updatedAt)}</div></section>
        ${party.type === "group" ? `<section class="info-card wide"><div class="card-title"><span class="card-icon violet">◇</span><div><h3>Group composition</h3><p>Active links and ended membership history</p></div></div><div class="connection-list">${memberRows}</div></section>` : ""}
        <section class="info-card wide"><div class="card-title"><span class="card-icon">↗</span><div><h3>Matter participation</h3><p>Context-specific roles never change Party identity</p></div></div>${participationRows}</section>
      </div></div>
      ${party.type === "group" ? `<div class="tab-content" data-panel="members"><div class="relationship-title"><div><div class="section-kicker">GROUP MEMBERSHIP</div><h3>Member Parties</h3></div><span class="count-pill">${activeCount(party)} active</span></div><div class="connection-list" style="margin-top:14px">${memberRows}</div></div>` : ""}
      <div class="tab-content" data-panel="references"><div class="relationship-title"><div><div class="section-kicker">CONTEXTUAL RELATIONSHIPS</div><h3>Matter references</h3></div><span class="count-pill">${participations.length} total</span></div><div style="margin-top:14px">${participationRows}</div></div>
      </div>`;
    applyDetailZoom();
    updateDetailZoomControls();
  }
  function applyDetailZoom() {
    const zoomContent = detail.querySelector(".detail-zoom-content");
    if (!zoomContent) return;
    const scale = detailZoom / 100;
    const detailStyle = getComputedStyle(detail);
    const availableWidth = detail.clientWidth - parseFloat(detailStyle.paddingLeft) - parseFloat(detailStyle.paddingRight);
    zoomContent.style.width = `${availableWidth / scale}px`;
    zoomContent.style.transform = `scale(${scale})`;
    zoomContent.style.marginBottom = `${zoomContent.offsetHeight * (scale - 1)}px`;
  }
  function updateDetailZoomControls() {
    const zoomOut = detail.querySelector('[data-zoom="out"]');
    const zoomIn = detail.querySelector('[data-zoom="in"]');
    const zoomReset = detail.querySelector('[data-zoom="reset"]');
    if (!zoomOut || !zoomIn || !zoomReset) return;
    zoomOut.disabled = detailZoom <= 80;
    zoomIn.disabled = detailZoom >= 140;
    zoomReset.textContent = `${detailZoom}%`;
    zoomReset.setAttribute("aria-label", `Detail pane zoom is ${detailZoom} percent; reset to 100 percent`);
  }

  function addMembershipRow(membership = {}) {
    const holder = $("#membership-rows");
    const members = parties.filter(item => (item.type === "individual" || item.type === "company") && item.id !== $("#form-id").value);
    const row = document.createElement("div");
    row.className = "member-form-row";
    row.dataset.membershipId = membership.id || "";
    row.innerHTML = `<label>Member Party<select class="member-select"><option value="">Choose Party</option>${members.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.displayName)} · ${escapeHtml(item.id)} · ${escapeHtml(labelType(item.type))}</option>`).join("")}</select></label>
      <label>Group-specific role<input class="member-role" maxlength="100" placeholder="Optional"></label>
      <label>Effective from<input class="member-from" type="date"></label>
      <label>Effective to<input class="member-to" type="date"></label>
      <label>Status<select class="member-status"><option>Active</option><option>Ended</option></select></label>
      <button class="remove-row member-remove" type="button">${membership.id ? "End link" : "Remove"}</button>`;
    row.querySelector(".member-select").value = membership.memberId || "";
    row.querySelector(".member-role").value = membership.role || "";
    row.querySelector(".member-from").value = membership.from || "";
    row.querySelector(".member-to").value = membership.to || "";
    row.querySelector(".member-status").value = membership.status || "Active";
    if (membership.id && membership.status === "Ended") {
      row.querySelector(".member-status").disabled = true;
      row.querySelector(".member-remove").disabled = true;
      row.querySelector(".member-remove").textContent = "History";
    }
    holder.append(row);
  }
  function addMatterRow(ref = {}) {
    const row = document.createElement("div");
    row.className = "matter-form-row";
    row.innerHTML = `<label class="matter-field">Matter ID<input class="matter-id" maxlength="60" placeholder="e.g. MAT-2048"></label><label class="matter-field">Matter name<input class="matter-name" maxlength="120" placeholder="Optional name"></label><label class="matter-field">Participation role<input class="matter-role" maxlength="100" placeholder="e.g. Borrower"></label><button class="remove-row matter-remove" type="button">Remove</button>`;
    row.querySelector(".matter-id").value = ref.matterId || "";
    row.querySelector(".matter-name").value = ref.matterName || "";
    row.querySelector(".matter-role").value = ref.role || "";
    $("#matter-rows").append(row);
  }
  function openForm(party = null) {
    form.reset();
    $("#form-feedback").hidden = true;
    $("#form-feedback").innerHTML = "";
    $("#membership-rows").replaceChildren();
    $("#matter-rows").replaceChildren();
    clearCompaniesHouseSearch();
    lastCompanySearchName = "";
    lastCompanyApiKey = "";
    $("#dialog-title").textContent = party ? "Edit Party" : "New Party";
    $("#form-id").value = party?.id || "";
    $("#form-name").value = party?.displayName || "";
    $("#form-type").value = party?.type || "";
    $("#form-type").disabled = Boolean(party);
    $("#form-status").value = party?.status || "Active";
    $("#form-given").value = party?.givenNames || "";
    $("#form-family").value = party?.familyName || "";
    $("#form-dob").value = party?.dateOfBirth || "";
    $("#form-nationality").value = party?.nationality || "";
    $("#form-legal").value = party?.legalName || "";
    $("#companies-house-query").value = party?.legalName || party?.displayName || "";
    $("#form-trading").value = party?.tradingName || "";
    $("#form-legal-form").value = party?.legalForm || "";
    $("#form-registration").value = party?.registrationNumber || "";
    $("#form-jurisdiction").value = party?.jurisdiction || "";
    (party?.memberships || []).forEach(addMembershipRow);
    (party?.participations || []).forEach(addMatterRow);
    updateTypeFields();
    dialog.showModal();
    $("#form-name").focus();
  }
  function updateTypeFields() {
    const type = $("#form-type").value;
    $("#individual-fields").hidden = type !== "individual";
    $("#company-fields").hidden = type !== "company";
    $("#group-fields").hidden = type !== "group";
    updateCompaniesHouseSearch(true);
  }
  function syncCompanyNameFields() {
    const displayName = $("#form-name").value;
    $("#form-legal").value = displayName;
    $("#companies-house-query").value = displayName;
  }
  function clearCompaniesHouseSearch() {
    companySearchRequestId += 1;
    companySearchInProgress = false;
    companiesHouseResults = [];
    $("#companies-house-request").hidden = true;
    $("#companies-house-request-details").textContent = "";
    $("#companies-house-response-details").textContent = "";
    $("#companies-house-search-status").textContent = "";
    $("#companies-house-results").replaceChildren();
    $("#companies-house-results").hidden = true;
  }
  function updateCompaniesHouseSearch(clearIfChanged = false) {
    const companyName = $("#companies-house-query").value.trim();
    const apiKey = $("#companies-house-api-key").value.trim();
    if (clearIfChanged && (companyName !== lastCompanySearchName || apiKey !== lastCompanyApiKey)) {
      clearCompaniesHouseSearch();
    }
    lastCompanySearchName = companyName;
    lastCompanyApiKey = apiKey;
    const usesMockData = M.isCompaniesHouseMockSearch(companyName);
    $("#companies-house-search").disabled = $("#form-type").value !== "company"
      || !companyName || (!apiKey && !usesMockData) || companySearchInProgress;
  }
  function renderCompaniesHouseResults(companies) {
    const results = $("#companies-house-results");
    results.replaceChildren();
    companies.forEach((company, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "company-result";
      button.dataset.companyIndex = String(index);
      const title = document.createElement("strong");
      title.textContent = company.title || "Company name unavailable";
      const details = document.createElement("small");
      details.textContent = [company.company_number, company.company_status, company.company_type,
        company.date_of_cessation ? `Dissolved ${company.date_of_cessation}` : ""]
        .filter(Boolean).join(" · ");
      button.append(title, details);
      const item = document.createElement("li");
      item.append(button);
      results.append(item);
    });
    results.hidden = companies.length === 0;
  }
  async function searchCompaniesHouse() {
    const companyName = $("#companies-house-query").value.trim();
    const apiKey = $("#companies-house-api-key").value.trim();
    const requestId = ++companySearchRequestId;
    companySearchInProgress = true;
    companiesHouseResults = [];
    updateCompaniesHouseSearch();
    const usesMockData = M.isCompaniesHouseMockSearch(companyName);
    $("#companies-house-search-status").textContent = usesMockData
      ? "Loading local mock Companies House results…"
      : "Searching Companies House…";
    $("#companies-house-results").replaceChildren();
    $("#companies-house-results").hidden = true;
    $("#companies-house-request-details").textContent = usesMockData
      ? `LOCAL MOCK RESPONSE for "${companyName}"\nNo network request was made.`
      : [
        `GET ${M.companiesHouseSearchUrl(companyName)}`,
        "Accept: application/json",
        "Authorization: Basic [REDACTED — API key provided in the form]",
        "",
        "(no request body)"
      ].join("\n");
    $("#companies-house-response-details").textContent = "Waiting for response…";
    $("#companies-house-request").hidden = false;
    try {
      const companies = await M.searchCompaniesHouse(companyName, apiKey, undefined, response => {
        if (requestId === companySearchRequestId) {
          $("#companies-house-response-details").textContent = JSON.stringify(response, null, 2);
        }
      });
      if (requestId !== companySearchRequestId) return;
      companiesHouseResults = companies;
      renderCompaniesHouseResults(companies);
      $("#companies-house-search-status").textContent = companies.length
        ? `${companies.length} ${usesMockData ? "mock " : ""}results. Select a company to use its details.`
        : "No matching companies found.";
    } catch (error) {
      if (requestId !== companySearchRequestId) return;
      if ($("#companies-house-response-details").textContent === "Waiting for response…") {
        $("#companies-house-response-details").textContent = "No response JSON available.";
      }
      $("#companies-house-search-status").textContent = error instanceof Error
        ? error.message
        : "Company search failed. Try again.";
    } finally {
      if (requestId === companySearchRequestId) {
        companySearchInProgress = false;
        updateCompaniesHouseSearch();
      }
    }
  }
  function selectCompaniesHouseResult(index) {
    const company = companiesHouseResults[index];
    if (!company) return;
    $("#form-name").value = company.title || "";
    $("#form-legal").value = company.title || "";
    $("#form-registration").value = company.company_number || "";
    $("#form-legal-form").value = company.company_type || "";
    $("#form-jurisdiction").value = "United Kingdom";
    const recordStatus = M.companiesHouseRecordStatus(company.company_status);
    if (recordStatus) $("#form-status").value = recordStatus;
    $("#companies-house-query").value = company.title || "";
    updateCompaniesHouseSearch(true);
  }
  function collectParty() {
    const id = $("#form-id").value;
    const existing = parties.find(item => item.id === id);
    const party = {
      ...(existing || {}),
      id: id || nextPartyId(),
      type: existing?.type || $("#form-type").value,
      displayName: $("#form-name").value.trim(),
      status: $("#form-status").value,
      givenNames: $("#form-given").value.trim(),
      familyName: $("#form-family").value.trim(),
      dateOfBirth: $("#form-dob").value,
      nationality: $("#form-nationality").value.trim(),
      legalName: $("#form-legal").value.trim(),
      tradingName: $("#form-trading").value.trim(),
      legalForm: $("#form-legal-form").value.trim(),
      registrationNumber: $("#form-registration").value.trim(),
      jurisdiction: $("#form-jurisdiction").value.trim(),
      memberships: [],
      participations: [],
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (party.type === "group") {
      party.memberships = [...$("#membership-rows").querySelectorAll(".member-form-row")].map((row, index) => ({
        id: row.dataset.membershipId || `MEM-${Date.now()}-${index}`,
        memberId: row.querySelector(".member-select").value,
        role: row.querySelector(".member-role").value.trim(),
        from: row.querySelector(".member-from").value,
        to: row.querySelector(".member-to").value,
        status: row.querySelector(".member-status").value
      }));
    } else {
      party.memberships = undefined;
    }
    party.participations = [...$("#matter-rows").querySelectorAll(".matter-form-row")].map(row => ({
      matterId: row.querySelector(".matter-id").value.trim(),
      matterName: row.querySelector(".matter-name").value.trim(),
      role: row.querySelector(".matter-role").value.trim()
    })).filter(ref => ref.matterId || ref.matterName || ref.role);
    return party;
  }
  function nextPartyId() {
    const max = parties.reduce((result, party) => {
      const match = /^PTY-(\d+)$/.exec(party.id);
      return match ? Math.max(result, Number(match[1])) : result;
    }, 1000);
    return `PTY-${String(max + 1).padStart(4, "0")}`;
  }
  function displayErrors(errors) {
    const feedback = $("#form-feedback");
    feedback.innerHTML = `<strong>Please correct the following:</strong><ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
    feedback.hidden = false;
    feedback.scrollIntoView({ block: "nearest" });
  }

  $("#create-button").addEventListener("click", () => openForm());
  window.addEventListener("resize", applyDetailZoom);
  $("#theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
  $("#edit-button"); // Detail action is rebound after each detail render below.
  $("#party-list").addEventListener("click", event => {
    const row = event.target.closest("[data-id]");
    if (row) { selectedId = row.dataset.id; renderList(); }
  });
  $("#party-list").addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-id]")) {
      event.preventDefault(); selectedId = event.target.dataset.id; renderList();
    }
  });
  detail.addEventListener("click", event => {
    const zoomButton = event.target.closest("[data-zoom]");
    if (zoomButton) {
      if (zoomButton.dataset.zoom === "reset") detailZoom = 100;
      else detailZoom = Math.max(80, Math.min(140, detailZoom + (zoomButton.dataset.zoom === "in" ? 10 : -10)));
      applyDetailZoom();
      updateDetailZoomControls();
      return;
    }
    const edit = event.target.closest("#edit-button");
    if (edit) { openForm(parties.find(party => party.id === selectedId)); return; }
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      detail.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button === tab));
      detail.querySelectorAll(".tab-content").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab));
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open) { selectedId = open.dataset.open; renderList(); }
  });
  $("#search-input").addEventListener("input", renderList);
  $("#type-filter").addEventListener("change", renderList);
  $("#status-filter").addEventListener("change", renderList);
  $("#form-type").addEventListener("change", () => {
    if ($("#form-type").value === "company") syncCompanyNameFields();
    updateTypeFields();
  });
  $("#form-name").addEventListener("input", () => {
    if ($("#form-type").value === "company") {
      syncCompanyNameFields();
      updateCompaniesHouseSearch(true);
    }
  });
  $("#companies-house-query").addEventListener("input", () => updateCompaniesHouseSearch(true));
  $("#companies-house-query").addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); searchCompaniesHouse(); }
  });
  $("#companies-house-api-key").addEventListener("input", () => updateCompaniesHouseSearch(true));
  $("#companies-house-search").addEventListener("click", searchCompaniesHouse);
  $("#companies-house-results").addEventListener("click", event => {
    const button = event.target.closest("[data-company-index]");
    if (button) selectCompaniesHouseResult(Number(button.dataset.companyIndex));
  });
  $("#add-member").addEventListener("click", () => addMembershipRow());
  $("#add-matter").addEventListener("click", () => addMatterRow());
  $("#membership-rows").addEventListener("click", event => {
    const button = event.target.closest(".member-remove");
    if (!button) return;
    const row = button.closest(".member-form-row");
    if (row.dataset.membershipId) {
      row.querySelector(".member-status").value = "Ended";
      row.querySelector(".member-status").disabled = false;
      if (!row.querySelector(".member-to").value) row.querySelector(".member-to").value = new Date().toISOString().slice(0, 10);
      button.disabled = true;
      button.textContent = "Ended";
    } else row.remove();
  });
  $("#matter-rows").addEventListener("click", event => {
    const button = event.target.closest(".matter-remove");
    if (button) button.closest(".matter-form-row").remove();
  });
  $("#party-form").addEventListener("submit", event => {
    event.preventDefault();
    const party = collectParty();
    const errors = M.validateParty(party, parties, party.id);
    if (errors.length) { displayErrors(errors); return; }
    const index = parties.findIndex(item => item.id === party.id);
    if (index >= 0) parties[index] = party;
    else parties.unshift(party);
    if (!persist()) return;
    selectedId = party.id;
    $("#form-type").disabled = false;
    dialog.close();
    renderList();
    showToast(index >= 0 ? "Party updated in this browser." : "Party created in this browser.");
  });
  function closeDialog() { $("#form-type").disabled = false; dialog.close(); }
  dialog.addEventListener("close", () => {
    $("#companies-house-api-key").value = "";
    clearCompaniesHouseSearch();
    lastCompanySearchName = "";
    lastCompanyApiKey = "";
  });
  $("#cancel-dialog").addEventListener("click", closeDialog);
  $("#close-dialog").addEventListener("click", closeDialog);
  dialog.addEventListener("click", event => { if (event.target === dialog) closeDialog(); });
  $("#reset-button").addEventListener("click", () => {
    if (!window.confirm("Reset this browser's Party records to the fictional sample data?")) return;
    parties = M.getSampleParties();
    if (!persist()) return;
    selectedId = parties[0]?.id || "";
    renderList();
    showToast("Fictional sample data restored.");
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); $("#search-input").focus();
    }
  });
  renderList();
})();
