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
const routes = [
  "/",
  "/dashboard",
  "/spin",
  "/wheels/new",
  "/chains",
  "/chains/new",
  "/templates",
  "/tournaments",
  "/participants",
  "/settings",
  "/privacy",
  "/chains/demo_chain_fantasy_story/run",
];
const requiredHeaders = [
  "content-security-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-frame-options",
  "permissions-policy",
  "strict-transport-security",
];
const expectedHeaders = {
  "content-security-policy": (value) => value.includes("default-src 'self'") && value.includes("object-src 'none'") && value.includes("frame-ancestors 'none'") && value.includes("script-src 'self'"),
  "referrer-policy": (value) => value === "strict-origin-when-cross-origin",
  "x-content-type-options": (value) => value === "nosniff",
  "x-frame-options": (value) => value === "DENY",
  "permissions-policy": (value) => value === "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": (value) => /^max-age=31536000(?:;|$)/.test(value) && value.includes("includeSubDomains"),
};
const verifiedAssets = new Set();

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
  const moduleSource = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)?.[1];
  assert.ok(moduleSource, `${route} is missing the module entry script.`);
  for (const header of requiredHeaders) {
    const value = response.headers.get(header);
    assert.ok(value, `${route} is missing the ${header} header.`);
    assert.ok(expectedHeaders[header](value), `${route} has a weakened ${header} header: ${value}`);
  }
  const assetUrl = new URL(moduleSource, response.url).toString();
  if (!verifiedAssets.has(assetUrl)) {
    const assetResponse = await fetch(assetUrl, { redirect: "follow" });
    assert.ok(assetResponse.ok, `The module entry asset returned HTTP ${assetResponse.status}: ${assetUrl}`);
    const assetContentType = assetResponse.headers.get("content-type") ?? "";
    assert.match(assetContentType, /(javascript|ecmascript|text\/plain)/i, `The module entry asset is not JavaScript: ${assetUrl}`);
    verifiedAssets.add(assetUrl);
  }
  return response.url;
}

const resolvedUrls = [];
for (const route of routes) {
  resolvedUrls.push(await fetchRoute(route));
}

const healthResponse = await fetch(`${baseUrl}/health.json`, { redirect: "follow" });
assert.ok(healthResponse.ok, `/health.json returned HTTP ${healthResponse.status}.`);
assert.match(healthResponse.headers.get("content-type") ?? "", /application\/json/i, "/health.json is not JSON.");
assert.equal(healthResponse.headers.get("cache-control"), "no-store", "/health.json must not be cached.");
const health = await healthResponse.json();
assert.deepEqual(health, { service: "wheelforge", status: "ok" }, "/health.json has an unexpected payload.");

if (process.env.NODE_ENV === "production") {
  for (const resolvedUrl of resolvedUrls) {
    assert.equal(new URL(resolvedUrl).protocol, "https:", `Production route redirected to non-HTTPS URL: ${resolvedUrl}`);
  }
}

console.log(`Deployment smoke verification passed for ${routes.length} routes at ${baseUrl}.`);
