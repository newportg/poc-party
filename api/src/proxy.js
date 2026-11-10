"use strict";

const COMPANIES_HOUSE_SEARCH_URL = "https://api.company-information.service.gov.uk/search/companies";
const MAX_QUERY_LENGTH = 160;

function jsonResponse(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
  });
}

function getCorsHeaders(origin, allowedOrigins) {
  const headers = { "Cache-Control": "no-store", Vary: "Origin" };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Accept";
  }
  return headers;
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.has(origin);
}

async function handleCompaniesHouseSearch(request, dependencies = {}) {
  const env = dependencies.env || process.env;
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = new Set(
    (env.CORS_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)
  );
  const headers = getCorsHeaders(origin, allowedOrigins);

  if (!isAllowedOrigin(origin, allowedOrigins)) {
    return jsonResponse(403, { error: "This website is not allowed to use the company search proxy." }, headers);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET") {
    return jsonResponse(405, { error: "Only GET requests are supported." }, headers);
  }

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return jsonResponse(400, { error: "Enter a company name to search." }, headers);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonResponse(400, { error: `Company name must be ${MAX_QUERY_LENGTH} characters or fewer.` }, headers);
  }

  const apiKey = env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    console.error("Companies House proxy is missing COMPANIES_HOUSE_API_KEY.");
    return jsonResponse(503, { error: "Company search is not configured." }, headers);
  }

  const upstreamUrl = new URL(COMPANIES_HOUSE_SEARCH_URL);
  upstreamUrl.searchParams.set("q", query);
  upstreamUrl.searchParams.set("items_per_page", "10");

  let upstream;
  try {
    upstream = await fetchImpl(upstreamUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:`, "utf8").toString("base64")}`
      },
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    console.error("Companies House request failed.", error);
    return jsonResponse(502, { error: "Could not reach Companies House. Try again later." }, headers);
  }

  if (upstream.status === 401) {
    console.error("Companies House rejected the configured API key.");
    return jsonResponse(502, { error: "Company search is temporarily unavailable." }, headers);
  }
  if (upstream.status === 429) {
    return jsonResponse(429, { error: "Companies House rate limit reached. Wait a moment and try again." }, headers);
  }
  if (!upstream.ok) {
    console.error(`Companies House returned HTTP ${upstream.status}.`);
    return jsonResponse(502, { error: "Companies House request failed. Try again later." }, headers);
  }

  let data;
  try {
    data = await upstream.json();
  } catch (error) {
    console.error("Companies House returned invalid JSON.", error);
    return jsonResponse(502, { error: "Companies House returned an invalid response." }, headers);
  }
  if (!data || !Array.isArray(data.items)) {
    console.error("Companies House returned an unexpected response shape.");
    return jsonResponse(502, { error: "Companies House returned an unexpected response." }, headers);
  }

  return jsonResponse(200, data, headers);
}

module.exports = { handleCompaniesHouseSearch, getCorsHeaders, isAllowedOrigin };
