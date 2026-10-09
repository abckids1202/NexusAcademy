import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const distIndexPath = join(root, "dist", "index.html");
const vercelPath = join(root, "vercel.json");

const [indexHtml, vercelSource] = await Promise.all([
  readFile(distIndexPath, "utf8"),
  readFile(vercelPath, "utf8"),
]);

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

console.log(`Static deployment configuration verified: ${requiredHeaders.length} security headers, SPA fallback, and ${indexHtml.length} bytes of generated HTML.`);
