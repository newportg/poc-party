const test = require("node:test");
const assert = require("node:assert/strict");
const { createOpenApiDocument, handleOpenApiDocument } = require("../src/openapi");

const origin = "https://newportg.github.io";
const env = { CORS_ALLOWED_ORIGINS: origin };

function makeRequest(path = "/api/openapi.json", options = {}) {
  return new Request(`https://party-proxy.azurewebsites.net${path}`, {
    method: options.method || "GET",
    headers: options.headers || { Origin: origin }
  });
}

test("OpenAPI document describes the deployed proxy server and search contract", () => {
  const document = createOpenApiDocument(makeRequest());
  assert.equal(document.openapi, "3.0.3");
  assert.deepEqual(document.servers, [{ url: "https://party-proxy.azurewebsites.net/api" }]);
  const operation = document.paths["/companies-house-search"].get;
  assert.equal(operation.operationId, "searchCompaniesHouse");
  assert.equal(operation.parameters[0].name, "q");
  assert.equal(operation.parameters[0].schema.maxLength, 160);
  for (const status of ["200", "400", "403", "429", "502", "503"]) {
    assert.ok(operation.responses[status], `Expected documented HTTP ${status} response`);
  }
});

test("OpenAPI endpoint serves JSON with allowed-origin CORS headers", async () => {
  const response = await handleOpenApiDocument(makeRequest(), { env });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.match(response.headers.get("Content-Type"), /openapi\+json/);
  assert.deepEqual(await response.json(), createOpenApiDocument(makeRequest()));
});

test("OpenAPI endpoint rejects unapproved origins and non-GET methods", async () => {
  const denied = await handleOpenApiDocument(makeRequest("/api/openapi.json", {
    headers: { Origin: "https://untrusted.example" }
  }), { env });
  assert.equal(denied.status, 403);

  const methodNotAllowed = await handleOpenApiDocument(makeRequest("/api/openapi.json", {
    method: "POST"
  }), { env });
  assert.equal(methodNotAllowed.status, 405);
});
