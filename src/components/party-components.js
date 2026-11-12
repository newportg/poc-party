(function (root) {
  "use strict";

  const model = root.PartyModel;
  if (!model) throw new Error("Party components require PartyModel to be loaded first.");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

  class PartyCatalogue extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._parties = [];
      this._query = "";
      this._type = "";
      this._status = "";
      this._selectedId = "";
    }

    connectedCallback() {
      this.shadowRoot.innerHTML = `<style>
        :host{display:block;color:#e8e8f0;font:14px system-ui,sans-serif}.toolbar{display:grid;grid-template-columns:1fr 150px 150px;gap:8px;margin-bottom:12px}input,select{min-height:36px;border:1px solid #30303e;border-radius:7px;background:#15151f;color:inherit;padding:0 10px}.list{display:grid;gap:6px;max-height:420px;overflow:auto}.party{display:flex;align-items:center;gap:10px;width:100%;border:1px solid #2d2c3b;border-radius:8px;background:#15151f;color:inherit;padding:9px;text-align:left;cursor:pointer}.party:hover,.party.selected{border-color:#7772f5;background:#7772f526}.avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#292744;color:#b9b4ff;font-size:10px;font-weight:700}.copy{display:flex;flex-direction:column;min-width:0;flex:1}.copy strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.copy small{color:#85849a;font-size:9px;margin-top:2px}.status{color:#61d5a5;font-size:9px}.empty{color:#85849a;padding:20px;text-align:center}@media(max-width:600px){.toolbar{grid-template-columns:1fr}.toolbar select{width:100%}}
      </style><div class="toolbar"><input id="query" type="search" placeholder="Search name, ID, company, or contact"><select id="type"><option value="">All types</option><option>individual</option><option>company</option><option>group</option></select><select id="status"><option value="">Any status</option><option>Active</option><option>Inactive</option><option>Archived</option></select></div><div class="list" id="list"></div>`;
      this.shadowRoot.querySelector("#query").addEventListener("input", event => { this._query = event.target.value; this.render(); });
      this.shadowRoot.querySelector("#type").addEventListener("change", event => { this._type = event.target.value; this.render(); });
      this.shadowRoot.querySelector("#status").addEventListener("change", event => { this._status = event.target.value; this.render(); });
      this.render();
    }

    set parties(value) { this._parties = Array.isArray(value) ? value : []; this.render(); }
    get parties() { return this._parties; }
    set selectedId(value) { this._selectedId = value || ""; this.render(); }
    get selectedId() { return this._selectedId; }
    get filteredParties() { return model.searchParties(this._parties, this._query, this._type, this._status); }

    render() {
      const list = this.shadowRoot?.querySelector("#list");
      if (!list) return;
      const rows = this.filteredParties;
      list.innerHTML = rows.length ? rows.map(party => `<button class="party ${party.id === this._selectedId ? "selected" : ""}" type="button" data-id="${esc(party.id)}"><span class="avatar">${esc((party.displayName || "P").slice(0, 1).toUpperCase())}</span><span class="copy"><strong>${esc(party.displayName)}</strong><small>${esc(party.id)} · ${esc(party.type)}</small></span><span class="status">${esc(party.status)}</span></button>`).join("") : `<div class="empty">No parties match these filters.</div>`;
      list.querySelectorAll("[data-id]").forEach(button => button.addEventListener("click", () => {
        const party = this._parties.find(item => item.id === button.dataset.id);
        this._selectedId = party?.id || "";
        this.render();
        this.dispatchEvent(new CustomEvent("party-selected", { bubbles: true, composed: true, detail: { party } }));
      }));
    }
  }

  class PartyEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._party = null;
      this._parties = [];
    }

    connectedCallback() {
      this.shadowRoot.innerHTML = `<style>
        :host{display:block;color:#e8e8f0;font:14px system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:flex;flex-direction:column;gap:5px;color:#aaa9ba;font-size:11px}label.wide{grid-column:1/-1}input,select{min-height:36px;border:1px solid #30303e;border-radius:7px;background:#15151f;color:inherit;padding:0 10px}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.button{border:1px solid #373646;border-radius:7px;background:#15151f;color:inherit;padding:9px 13px;cursor:pointer}.primary{background:#716df6;border-color:#716df6;color:#fff}.feedback{color:#ffb6b8;background:#3a2024;border:1px solid #8d4649;border-radius:7px;padding:9px;margin-bottom:12px;font-size:11px}.section{grid-column:1/-1;color:#aaa5ff;font-size:9px;font-weight:700;letter-spacing:1px}@media(max-width:600px){.grid{grid-template-columns:1fr}label.wide,.section{grid-column:auto}}
      </style><form novalidate><div class="feedback" id="feedback" hidden></div><div class="grid">
        <div class="section">PARTY RECORD</div><label class="wide">Display name *<input name="displayName" required maxlength="120"></label><label>Party type *<select name="type" required><option value="individual">Individual</option><option value="company">Company</option><option value="group">Group</option></select></label><label>Record status *<select name="status" required><option>Active</option><option>Inactive</option><option>Archived</option></select></label>
        <div class="section" data-individual>INDIVIDUAL DETAILS</div><label data-individual>Given names<input name="givenNames"></label><label data-individual>Family name<input name="familyName"></label><label data-individual>Date of birth<input name="dateOfBirth" type="date"></label><label data-individual>Nationality<input name="nationality"></label>
        <div class="section" data-company hidden>COMPANY DETAILS</div><label data-company>Legal name<input name="legalName"></label><label data-company>Trading name<input name="tradingName"></label><label data-company>Legal form<input name="legalForm"></label><label data-company>Registration reference<input name="registrationNumber"></label><label data-company>Jurisdiction<input name="jurisdiction"></label>
      </div><div class="actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">Save Party</button></div></form>`;
      this.shadowRoot.querySelector("[name=type]").addEventListener("change", () => this.updateTypeFields());
      this.shadowRoot.querySelector("form").addEventListener("submit", event => { event.preventDefault(); this.save(); });
      this.shadowRoot.querySelector("[data-cancel]").addEventListener("click", () => this.dispatchEvent(new CustomEvent("party-cancelled", { bubbles: true, composed: true })));
      this.updateTypeFields();
      this.populate();
    }

    set party(value) { this._party = value || null; this.populate(); }
    get party() { return this._party; }
    set parties(value) { this._parties = Array.isArray(value) ? value : []; }
    get parties() { return this._parties; }
    field(name) { return this.shadowRoot.querySelector(`[name="${name}"]`); }
    populate() {
      if (!this.shadowRoot) return;
      const party = this._party || {};
      ["displayName", "type", "status", "givenNames", "familyName", "dateOfBirth", "nationality", "legalName", "tradingName", "legalForm", "registrationNumber", "jurisdiction"].forEach(name => { const field = this.field(name); if (field) field.value = party[name] || (name === "type" ? "individual" : name === "status" ? "Active" : ""); });
      this.updateTypeFields();
    }
    updateTypeFields() {
      const company = this.field("type")?.value === "company";
      this.shadowRoot?.querySelectorAll("[data-company]").forEach(element => { element.hidden = !company; });
      this.shadowRoot?.querySelectorAll("[data-individual]").forEach(element => { element.hidden = company; });
    }
    save() {
      const form = this.shadowRoot.querySelector("form");
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const party = { ...this._party, ...data, id: this._party?.id || `PTY-${Date.now()}`, displayName: data.displayName, updatedAt: new Date().toISOString(), createdAt: this._party?.createdAt || new Date().toISOString() };
      const errors = model.validateParty(party, this._parties, this._party?.id || "");
      if (errors.length) { const feedback = this.shadowRoot.querySelector("#feedback"); feedback.hidden = false; feedback.innerHTML = errors.map(esc).join("<br>"); return; }
      this._party = party;
      this.dispatchEvent(new CustomEvent("party-saved", { bubbles: true, composed: true, detail: { party } }));
    }
  }

  root.customElements.define("poc-party-catalogue", PartyCatalogue);
  root.customElements.define("poc-party-editor", PartyEditor);
})(globalThis);
