import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const distRoot = join(process.cwd(), "dist");
const forbiddenPatterns = [
  { label: "Supabase service-role environment variable", pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
  { label: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]+\b/ },
  { label: "service-role marker", pattern: /\bservice_role\b/i },
  { label: "private-key material", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (/\.(?:html|js|css|json|map)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

const files = await collectFiles(distRoot);
const configuredSecrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY]
  .filter((value) => typeof value === "string" && value.length >= 8);
const findings = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(source)) findings.push(`${label}: ${file}`);
  }
  for (const secret of configuredSecrets) {
    if (source.includes(secret)) findings.push(`configured secret value: ${file}`);
  }
}

if (findings.length > 0) {
  throw new Error(`Client bundle secret scan failed:\n${[...new Set(findings)].join("\n")}`);
}

console.log(`Client bundle secret scan passed across ${files.length} generated assets.`);
