"use strict";

const { getCorsHeaders, isAllowedOrigin } = require("./proxy");

function createOpenApiDocument(request) {
  const url = new URL(request.url);
  return {
    openapi: "3.0.3",
    info: {
      title: "Party Companies House Search Proxy",
      version: "1.0.0",
      description: "Search the Companies House register through the Party Azure Functions proxy. The Companies House API key is held by the server and is never part of this API."
    },
    servers: [{ url: `${url.origin}/api` }],
    paths: {
      "/companies-house-search": {
        get: {
          operationId: "searchCompaniesHouse",
          summary: "Search companies",
          description: "Search by company name. Results are limited to ten records. This endpoint is publicly callable; CORS is not authentication.",
          parameters: [{
            name: "q",
            in: "query",
            required: true,
            description: "Company name to search for (1–160 characters).",
            schema: { type: "string", minLength: 1, maxLength: 160 },
            example: "Zoomalong Limited"
          }],
          responses: {
            "200": {
              description: "Companies House search response.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CompanySearchResponse" }
                }
              }
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "429": { $ref: "#/components/responses/RateLimited" },
            "502": { $ref: "#/components/responses/UpstreamError" },
            "503": { $ref: "#/components/responses/NotConfigured" }
          }
        }
      }
    },
    components: {
      schemas: {
        CompanySearchResponse: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/CompanySearchResult" }
            },
            total_results: { type: "integer", description: "Total matching Companies House records." },
            page_number: { type: "integer" },
            start_index: { type: "integer" },
            items_per_page: { type: "integer" }
          },
          additionalProperties: true
        },
        CompanySearchResult: {
          type: "object",
          properties: {
            title: { type: "string", example: "ZOOMALONG LIMITED" },
            company_number: { type: "string", example: "01234567" },
            company_status: { type: "string", example: "active" },
            company_type: { type: "string", example: "ltd" },
            address_snippet: { type: "string" },
            address: { type: "object", additionalProperties: true },
            links: { type: "object", additionalProperties: { type: "string" } }
          },
          additionalProperties: true
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } }
        }
      },
      responses: {
        BadRequest: {
          description: "Missing or invalid search query.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
        },
        Forbidden: {
          description: "The request origin is not allowed by the proxy.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
        },
        RateLimited: {
          description: "Companies House rate limit reached.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
        },
        UpstreamError: {
          description: "The proxy could not complete the Companies House request.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
        },
        NotConfigured: {
          description: "The proxy is missing its Companies House API key setting.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
        }
      }
    }
  };
}

async function handleOpenApiDocument(request, dependencies = {}) {
  const env = dependencies.env || process.env;
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = new Set(
    (env.CORS_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)
  );
  const headers = {
    ...getCorsHeaders(origin, allowedOrigins),
    "Content-Type": "application/vnd.oai.openapi+json;version=3.0; charset=utf-8"
  };

  if (!isAllowedOrigin(origin, allowedOrigins)) {
    return new Response(JSON.stringify({ error: "This website is not allowed to use the company search proxy." }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
    });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Only GET requests are supported." }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
    });
  }

  return new Response(JSON.stringify(createOpenApiDocument(request), null, 2), {
    status: 200,
    headers: { ...headers, "Cache-Control": "no-store" }
  });
}

module.exports = { createOpenApiDocument, handleOpenApiDocument };
