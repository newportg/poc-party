const { app } = require("@azure/functions");
const { handleCompaniesHouseSearch } = require("../proxy");

app.http("companies-house-search", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "companies-house-search",
  handler: handleCompaniesHouseSearch
});
