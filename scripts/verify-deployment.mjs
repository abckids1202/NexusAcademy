import assert from "node:assert/strict";

const configuredUrl = process.env.DEPLOYMENT_URL?.trim();
if (!configuredUrl) {
  throw new Error("Set DEPLOYMENT_URL to the deployed WheelForge origin, for example https://staging.example.com.");
}

const origin = new URL(configuredUrl);
assert.ok(["http:", "https:"].includes(origin.protocol), "DEPLOYMENT_URL must use http or https.");
if (process.env.NODE_ENV === "production") {
  assert.equal(origin.protocol, "https:", "Production deployment checks require HTTPS.");
}

const baseUrl = origin.toString().replace(/\/$/, "");
const routes = ["/", "/spin", "/chains", "/templates", "/tournaments", "/participants", "/settings"];
const requiredHeaders = [
  "content-security-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-frame-options",
  "permissions-policy",
  "strict-transport-security",
];

async function fetchRoute(route) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { accept: "text/html" },
    redirect: "follow",
  });
  assert.ok(response.ok, `${route} returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  assert.match(contentType, /text\/html/i, `${route} did not return an HTML app shell.`);
  const html = await response.text();
  assert.match(html, /<div id=["']root["']>/, `${route} is missing the React root.`);
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=/, `${route} is missing the module entry script.`);
  for (const header of requiredHeaders) {
    assert.ok(response.headers.get(header), `${route} is missing the ${header} header.`);
  }
  return response.url;
}

const resolvedUrls = [];
for (const route of routes) {
  resolvedUrls.push(await fetchRoute(route));
}

if (process.env.NODE_ENV === "production") {
  for (const resolvedUrl of resolvedUrls) {
    assert.equal(new URL(resolvedUrl).protocol, "https:", `Production route redirected to non-HTTPS URL: ${resolvedUrl}`);
  }
}

console.log(`Deployment smoke verification passed for ${routes.length} routes at ${baseUrl}.`);
