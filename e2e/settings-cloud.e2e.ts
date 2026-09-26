import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

const authUser = {
  id: "10000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "person@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

async function mockAuthEndpoint(route: Route) {
  const request = route.request();
  const headers = {
    "access-control-allow-origin": "http://127.0.0.1:5200",
    "access-control-allow-headers": "apikey,authorization,x-client-info,content-type",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
  };

  if (request.method() === "OPTIONS") {
    await route.fulfill({ status: 200, headers });
    return;
  }

  if (new URL(request.url()).pathname.endsWith("/auth/v1/user")) {
    await route.fulfill({ status: 200, headers, json: authUser });
    return;
  }

  if (new URL(request.url()).pathname.endsWith("/auth/v1/recover")) {
    await route.fulfill({ status: 200, headers, json: {} });
    return;
  }

  await route.fulfill({ status: 404, headers, json: { message: "Unexpected mocked Auth request" } });
}

async function seedRecoverySession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("sb-example-auth-token", JSON.stringify({
      access_token: "mock-recovery-access-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "mock-recovery-refresh-token",
      user: {
        id: "10000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "person@example.test",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      },
    }));
  });
}

test("password recovery sends a non-enumerating reset request to the Settings callback", async ({ page }) => {
  let recoveryUrl = "";
  await page.route("https://example.supabase.co/auth/v1/**", async (route) => {
    if (route.request().url().includes("/recover")) recoveryUrl = route.request().url();
    await mockAuthEndpoint(route);
  });

  await page.goto("/settings");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expectAccessible(page);
  await page.getByLabel("Email").fill("person@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByRole("status")).toContainText("If an account exists for that email");
  expect(recoveryUrl).toContain("redirect_to=http%3A%2F%2F127.0.0.1%3A5200%2Fsettings%3Fpassword-reset%3D1");
});

test("password recovery requires matching passwords and updates an authenticated session", async ({ page }) => {
  const updates: Array<Record<string, unknown>> = [];
  await page.route("https://example.supabase.co/auth/v1/**", async (route) => {
    if (route.request().method() === "PUT" && route.request().url().endsWith("/auth/v1/user")) {
      updates.push(route.request().postDataJSON() as Record<string, unknown>);
    }
    await mockAuthEndpoint(route);
  });
  await seedRecoverySession(page);

  await page.goto("/settings?password-reset=1");
  await expect(page.getByText("Choose a new password for person@example.test.")).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel("New password", { exact: true }).fill("updated-password-123");
  await page.getByLabel("Confirm new password", { exact: true }).fill("does-not-match");
  await expect(page.getByRole("button", { name: "Update password" })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");

  await page.getByLabel("Confirm new password", { exact: true }).fill("updated-password-123");
  await page.getByRole("button", { name: "Update password" }).click();

  await expect(page.getByRole("status")).toContainText("Password updated. You are now signed in.");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Signed in as")).toBeVisible();
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({ password: "updated-password-123" });
});
