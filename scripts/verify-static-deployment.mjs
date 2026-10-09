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

const requiredHeaders = [
  "Content-Security-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Permissions-Policy",
  "Strict-Transport-Security",
];
const configuredHeaders = new Set(
  vercel.headers?.flatMap((entry) => entry.headers ?? []).map((entry) => entry.key) ?? [],
);
const missingHeaders = requiredHeaders.filter((header) => !configuredHeaders.has(header));
if (missingHeaders.length > 0) throw new Error(`vercel.json is missing required security headers: ${missingHeaders.join(", ")}.`);

const healthHeader = vercel.headers?.some((entry) => entry.source === "/health.json" &&
  entry.headers?.some((header) => header.key === "Cache-Control" && header.value === "no-store"));
if (!healthHeader) throw new Error("vercel.json must keep the health endpoint uncached.");

console.log(`Static deployment configuration verified: health endpoint, ${requiredHeaders.length} security headers, SPA fallback, and ${indexHtml.length} bytes of generated HTML.`);
