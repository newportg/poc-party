# Companies House proxy

This JavaScript Azure Functions v4 HTTP-trigger project relays company-name
searches from the static Party app to Companies House. The API key is read only
from the Function App setting `COMPANIES_HOUSE_API_KEY`; it is never sent to or
stored by the browser.

## Run locally

Requirements: Node.js 20 or later, Azure Functions Core Tools v4, and Azurite.

1. From this directory, install dependencies and create local settings:

   ```powershell
   npm install
   Copy-Item local.settings.example.json local.settings.json
   ```

2. Put your Companies House key in `COMPANIES_HOUSE_API_KEY` in the ignored
   `local.settings.json` file. Do not commit this file.
3. Start Azurite, then run `npm start` in this directory.
4. In a separate terminal, serve the frontend from the repository root:

   ```powershell
   py -m http.server 8080 --directory src
   ```

5. In `src/config.js`, set `companiesHouseProxyUrl` to
   `http://localhost:7071/api/companies-house-search`. Open
   `http://localhost:8080` in a browser.

The local settings allow the local origin and the GitHub Pages origin. Set
`COMPANIES_HOUSE_API_KEY` before testing; an empty key produces HTTP 503.

## Deploy

Create a Node.js 22 Azure Function App (Functions host v4, Flex Consumption
recommended), then configure these application settings in the Azure portal:

- `COMPANIES_HOUSE_API_KEY`: your Companies House API key.
- `CORS_ALLOWED_ORIGINS`: `https://newportg.github.io` (add any exact custom
  domain origin you use, comma-separated).

From this directory, publish to the existing Function App (this project does not
provision Azure resources):

```powershell
npm install
func azure functionapp publish <function-app-name>
```

Set `companiesHouseProxyUrl` in `src/config.js` to
`https://<function-app-name>.azurewebsites.net/api/companies-house-search`,
commit that public endpoint URL, and publish the GitHub Pages site. The URL is
not a secret; never put the Companies House key in `src/` or GitHub Pages
configuration.

The GitHub Pages site also includes an interactive [OpenAPI reference](../src/openapi.html).
It loads the OpenAPI 3 document from
`https://<function-app-name>.azurewebsites.net/api/openapi.json` and uses Swagger UI's
Try it out feature. Keep the GitHub Pages origin in `CORS_ALLOWED_ORIGINS` to load the
document and send test calls from the page.

## Security

The function is an anonymous HTTP endpoint so a static browser app can call it
without exposing a Function key. CORS allows browsers to read responses only
from configured origins; it does **not** prevent scripts or other clients from
calling the endpoint. Protect a production or widely shared endpoint with a
rate-limiting gateway such as Azure API Management, and monitor upstream usage.
The proxy validates search length, limits results to ten, uses a fixed
Companies House host, disables response caching, and does not return the API key.

Run the proxy tests with `npm test`.
