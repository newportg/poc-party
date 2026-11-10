const { app } = require("@azure/functions");
const { handleOpenApiDocument } = require("../openapi");

app.http("openapi-document", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "openapi.json",
  handler: handleOpenApiDocument
});
