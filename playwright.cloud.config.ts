import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "settings-cloud.e2e.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{
    name: "chromium-cloud-mock",
    use: { ...devices["Desktop Chrome"] },
  }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5200 --strictPort",
    url: "http://127.0.0.1:5200",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_test_only",
    },
  },
});
