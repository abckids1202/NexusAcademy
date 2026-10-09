import { expect, test } from "@playwright/test";

test("the app shell and primary navigation load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
  await page.getByRole("link", { name: "Templates", exact: true }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole("heading", { name: "Start with a template" })).toBeVisible();
});

test("deep links recover into the application shell", async ({ page }) => {
  await page.goto("/tournaments");
  await expect(page.getByRole("heading", { name: "Tournaments", exact: true })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("template and tournament setup controls are usable", async ({ page }) => {
  await page.goto("/templates");
  await page.getByRole("button", { name: "Create pack" }).click();
  await expect(page.getByRole("region", { name: "Create template pack" })).toBeVisible();
  await page.goto("/tournaments");
  await page.getByLabel("Tournament name").fill("Cross browser cup");
  await page.getByRole("textbox", { name: /Participants/ }).fill("Avery\nJordan");
  await page.getByRole("button", { name: "Preview tournament" }).click();
  await expect(page.getByRole("region", { name: "Tournament preview" })).toBeVisible();
});
