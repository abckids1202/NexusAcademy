import { expect, test } from "@playwright/test";

test("quick spin validates a minimum roster and starts a saved wheel from pasted entries", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
  const entries = page.getByLabel("Entries");
  await entries.fill("Only one");
  await page.getByRole("button", { name: "Spin these entries" }).click();
  await expect(page.getByRole("alert")).toHaveText("Add at least two entries to spin.");

  await entries.fill("Pizza\n\nSushi\nPizza");
  await page.getByRole("button", { name: "Spin these entries" }).click();
  await expect(page).toHaveURL(/\/spin\/wheel_/);
  const quickWheel = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.wheels.find((wheel: { title: string }) => wheel.title === "Quick Choice");
  });
  expect(quickWheel.options.map((option: { label: string }) => option.label)).toEqual(["Pizza", "Sushi", "Pizza"]);
});

test("home workflow starts the matching template without the gallery detour", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Run a prize draw/ }).click();

  await expect(page).toHaveURL(/\/spin\/wheel_/);
  await expect(page.getByRole("heading", { name: "Giveaway Prize Wheel" })).toBeVisible();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null"));
  expect(data.recentTemplateIds[0]).toBe("giveaway-prize-wheel");
});

test("home workflow can launch a chained story generator", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Generate a fantasy story/ }).click();

  await expect(page).toHaveURL(/\/chains\/chain_.+\/run/);
  await expect(page.getByText("Fantasy Story Generator")).toBeVisible();
});

test("unknown routes show a recoverable not-found page inside the app shell", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");

  await expect(page.getByRole("heading", { name: "That page isn't here" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open dashboard" })).toHaveAttribute("href", "/dashboard");
});
