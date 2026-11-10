const test = require("node:test");
const assert = require("node:assert/strict");
const { handleCompaniesHouseSearch } = require("../src/proxy");

const origin = "https://newportg.github.io";
const env = {
  COMPANIES_HOUSE_API_KEY: "test-key",
  CORS_ALLOWED_ORIGINS: `${origin},http://localhost:8080`
};

function request(path = "?q=Acme%20Ltd", options = {}) {
  return new Request(`https://proxy.example/api/companies-house-search${path}`, {
    method: options.method || "GET",
    headers: options.headers || { Origin: origin }
  });
}

test("proxy forwards a bounded search with server-side Basic auth and CORS response headers", async () => {
  let upstreamRequest;
  const expected = { items: [{ title: "ACME LTD" }] };
  const response = await handleCompaniesHouseSearch(request(), {
    env,
    fetchImpl: async (url, options) => {
      upstreamRequest = { url: new URL(url), options };
      return Response.json(expected);
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(upstreamRequest.url.origin, "https://api.company-information.service.gov.uk");
  assert.equal(upstreamRequest.url.pathname, "/search/companies");
  assert.equal(upstreamRequest.url.searchParams.get("q"), "Acme Ltd");
  assert.equal(upstreamRequest.url.searchParams.get("items_per_page"), "10");
  assert.equal(upstreamRequest.options.headers.Authorization, `Basic ${Buffer.from("test-key:").toString("base64")}`);
  assert.deepEqual(await response.json(), expected);
});

test("proxy rejects unapproved origins and handles preflight", async () => {
  const denied = await handleCompaniesHouseSearch(request("?q=Acme", {
    headers: { Origin: "https://untrusted.example" }
  }), { env, fetchImpl: async () => { throw new Error("must not call upstream"); } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);

  const preflight = await handleCompaniesHouseSearch(request("", { method: "OPTIONS" }), { env });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Accept");
});

test("proxy validates search input and configuration before contacting Companies House", async () => {
  const empty = await handleCompaniesHouseSearch(request("?q=%20"), { env });
  assert.equal(empty.status, 400);
  const tooLong = await handleCompaniesHouseSearch(request(`?q=${"a".repeat(161)}`), { env });
  assert.equal(tooLong.status, 400);
  const unconfigured = await handleCompaniesHouseSearch(request(), {
    env: { CORS_ALLOWED_ORIGINS: origin }
  });
  assert.equal(unconfigured.status, 503);
});

test("proxy reports upstream rate limits and invalid responses explicitly", async () => {
  const limited = await handleCompaniesHouseSearch(request(), {
    env,
    fetchImpl: async () => new Response(null, { status: 429 })
  });
  assert.equal(limited.status, 429);

  const invalid = await handleCompaniesHouseSearch(request(), {
    env,
    fetchImpl: async () => Response.json({ unexpected: true })
  });
  assert.equal(invalid.status, 502);
});
