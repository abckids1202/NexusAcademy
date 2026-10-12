import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "package.json",
  "package-lock.json",
  ".nvmrc",
  "src/main.tsx",
  "public/health.json",
  "vercel.json",
  "docs/repository-boundary.md",
];

await Promise.all(requiredFiles.map(async (file) => {
  await access(join(root, file));
}));

const [packageSource, lockSource, nvmrc, vercelSource, boundarySource] = await Promise.all([
  readFile(join(root, "package.json"), "utf8"),
  readFile(join(root, "package-lock.json"), "utf8"),
  readFile(join(root, ".nvmrc"), "utf8"),
  readFile(join(root, "vercel.json"), "utf8"),
  readFile(join(root, "docs/repository-boundary.md"), "utf8"),
]);

const packageJson = JSON.parse(packageSource);
const packageLock = JSON.parse(lockSource);
const vercel = JSON.parse(vercelSource);

assert.equal(packageJson.engines?.node, ">=22.0.0", "package.json must require Node 22 or newer.");
assert.equal(packageJson.engines?.npm, ">=10.0.0", "package.json must require npm 10 or newer.");
assert.equal(nvmrc.trim(), "22", ".nvmrc must pin the supported Node major to 22.");
assert.deepEqual(packageLock.packages?.[""]?.engines, packageJson.engines, "package-lock.json must preserve the package runtime contract.");
assert.equal(packageJson.scripts?.build, "tsc -b && vite build", "The release build command must remain the root Vite build.");
assert.ok(vercel.rewrites?.some((entry) => entry.source === "/(.*)" && entry.destination === "/index.html"), "The hosting contract must preserve SPA fallback routing.");
assert.match(boundarySource, /root application is the only source covered by the WheelForge release gate/i, "The repository boundary must keep the root app as the release source.");
assert.match(boundarySource, /frontend\/.*backend\/.*worker\/.*infrastructure\//is, "Legacy directories must remain explicitly excluded from deployment.");

console.log("WheelForge release contract verified: Node 22, npm 10, root build, SPA fallback, required files, and monorepo boundary.");
