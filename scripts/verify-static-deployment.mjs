import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const distIndexPath = join(root, "dist", "index.html");
const distHealthPath = join(root, "dist", "health.json");
const vercelPath = join(root, "vercel.json");

const [indexHtml, healthSource, vercelSource] = await Promise.all([
  readFile(distIndexPath, "utf8"),
  readFile(distHealthPath, "utf8"),
  readFile(vercelPath, "utf8"),
]);

let health;
try {
  health = JSON.parse(healthSource);
} catch {
  throw new Error("dist/health.json is not valid JSON.");
}
if (health.service !== "wheelforge" || health.status !== "ok") {
  throw new Error("dist/health.json must identify a healthy WheelForge deployment.");
}

let vercel;
try {
  vercel = JSON.parse(vercelSource);
} catch {
  throw new Error("vercel.json is not valid JSON.");
}

if (!/<script[^>]+type="module"[^>]+src=/.test(indexHtml)) {
  throw new Error("dist/index.html does not contain a module entry script.");
}

const rewrite = vercel.rewrites?.some((entry) => entry.source === "/(.*)" && entry.destination === "/index.html");
if (!rewrite) throw new Error("vercel.json must provide an SPA fallback rewrite to /index.html.");

const requiredHeaders = new Map([
  ["Content-Security-Policy", (value) => value.includes("default-src 'self'") && value.includes("object-src 'none'") && value.includes("frame-ancestors 'none'") && value.includes("script-src 'self'")],
  ["Referrer-Policy", (value) => value === "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", (value) => value === "nosniff"],
  ["X-Frame-Options", (value) => value === "DENY"],
  ["Permissions-Policy", (value) => value === "camera=(), microphone=(), geolocation=()"],
  ["Strict-Transport-Security", (value) => /^max-age=31536000(?:;|$)/.test(value) && value.includes("includeSubDomains")],
]);
const configuredHeaders = new Map(
  vercel.headers?.flatMap((entry) => entry.headers ?? []).map((entry) => [entry.key, entry.value]) ?? [],
);
const missingHeaders = [...requiredHeaders.keys()].filter((header) => !configuredHeaders.has(header));
if (missingHeaders.length > 0) throw new Error(`vercel.json is missing required security headers: ${missingHeaders.join(", ")}.`);
const weakenedHeaders = [...requiredHeaders.entries()]
  .filter(([header, validate]) => !validate(configuredHeaders.get(header)))
  .map(([header]) => header);
if (weakenedHeaders.length > 0) throw new Error(`vercel.json contains weakened security headers: ${weakenedHeaders.join(", ")}.`);

const healthHeader = vercel.headers?.some((entry) => entry.source === "/health.json" &&
  entry.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store"));
if (!healthHeader) throw new Error("vercel.json must keep the health endpoint uncached.");

console.log(`Static deployment configuration verified: health endpoint, ${requiredHeaders.size} security headers, SPA fallback, and ${indexHtml.length} bytes of generated HTML.`);
