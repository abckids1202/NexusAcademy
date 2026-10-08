import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function collectViolations(page: Page, location: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.flatMap((violation) => {
    const targets = violation.nodes.flatMap((node) => node.target).join(", ");
    return `${location} · ${violation.id} (${violation.impact}): ${violation.help} [${targets}]`;
  });
}

test("main workflows have no automatically detectable WCAG A/AA violations", async ({ page }) => {
  test.setTimeout(150_000);
  const findings: string[] = [];
  const routes = [
    "/",
    "/dashboard",
    "/wheels/new",
    "/spin/demo_wheel_food_picker",
    "/chains/new",
    "/chains/demo_chain_fantasy_story/run",
    "/tournaments",
    "/templates",
    "/settings",
  ];

  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeFocused();

  for (const route of routes) {
    await page.goto(route);
    if (route === "/chains/new") await page.getByText("Conditional route and timing").click();
    findings.push(...await collectViolations(page, route));
  }

  await page.goto("/tournaments");
  await page.getByLabel("Tournament name").fill("Accessibility review");
  await page.locator(".participant-entry").fill("Avery\nJordan\nSam\nTaylor");
  await page.getByRole("button", { name: "Preview tournament" }).click();
  findings.push(...await collectViolations(page, "/tournaments preview"));
  await page.getByRole("button", { name: "Create this tournament" }).click();
  await expect(page).toHaveURL(/\/tournaments\/tournament_/);
  const tournamentUrl = page.url();
  findings.push(...await collectViolations(page, "/tournament detail"));
  await page.getByRole("button", { name: "CSV export" }).click();
  findings.push(...await collectViolations(page, "/tournament CSV export review"));
  await page.getByLabel("Anonymize participant names").check();
  await page.getByLabel(/Include local activity history/).check();
  findings.push(...await collectViolations(page, "/tournament CSV export privacy options"));
  await page.getByRole("button", { name: "CSV export" }).click();
  await page.getByRole("button", { name: "Set up chance-based draw" }).click();
  findings.push(...await collectViolations(page, "/tournament chance draw setup"));
  await page.getByRole("link", { name: "Host mode" }).click();
  findings.push(...await collectViolations(page, "/tournament host queue"));
  await page.getByRole("button", { name: "Audience" }).click();
  findings.push(...await collectViolations(page, "/tournament audience view"));
  await page.goto(tournamentUrl);
  await page.getByRole("link", { name: "Host mode" }).click();
  await expect(page.locator(".host-winner-actions")).toBeVisible();
  await page.locator(".host-winner-actions .host-primary-action").first().click();
  await page.locator(".host-winner-actions .host-primary-action").first().click();
  await page.locator(".host-winner-actions .host-primary-action").first().click();
  await page.getByRole("button", { name: "Correct result for Semifinals match 1" }).click();
  findings.push(...await collectViolations(page, "/tournament host correction panel"));

  await page.goto("/spin/demo_wheel_food_picker");
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
  findings.push(...await collectViolations(page, "/spin result dialog"));
  const closeButton = page.getByRole("button", { name: "Close result" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Copy result details" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Spin the wheel" })).toBeFocused();

  expect(findings, findings.join("\n")).toEqual([]);
});
