import { expect, test } from "@playwright/test";

test("an open tournament list reflects a tournament created in another tab", async ({ page, context }) => {
  await page.goto("/tournaments");
  const writer = await context.newPage();
  await writer.goto("/tournaments");

  await writer.getByLabel("Tournament name").fill("Cross-tab League");
  await writer.getByLabel(/Participants/).fill("Avery\nJordan");
  await writer.getByRole("button", { name: "Preview tournament" }).click();
  await writer.getByRole("button", { name: "Create this tournament" }).click();
  await expect(writer.getByRole("heading", { name: "Cross-tab League" })).toBeVisible();

  await expect(page.getByText("Cross-tab League", { exact: true })).toBeVisible();
});

test("an open chain editor offers a wheel created in another tab", async ({ page, context }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/chains/new");
  const wheelPicker = page.getByLabel("Wheel for step 1");
  const writer = await context.newPage();
  await writer.goto("/wheels/new");
  await writer.getByLabel("Title").fill("Cross-tab Wheel");
  await writer.getByRole("button", { name: "Save and spin" }).first().click();

  await expect(wheelPicker).toContainText("Cross-tab Wheel");
  expect(consoleErrors).toEqual([]);
});

test("a stale wheel draft cannot overwrite a newer tab and can be saved as a copy", async ({ page, context }) => {
  await page.goto("/wheels/demo_wheel_food_picker/edit");
  const draftTitle = page.getByLabel("Title");
  await draftTitle.fill("Stale local draft");

  const writer = await context.newPage();
  await writer.goto("/wheels/demo_wheel_food_picker/edit");
  await writer.getByLabel("Title").fill("Latest saved wheel");
  await writer.getByRole("button", { name: "Save and spin" }).first().click();

  await expect(page.getByRole("alert")).toContainText("This wheel changed in another tab");
  await expect(draftTitle).toHaveValue("Stale local draft");
  await expect(page.getByRole("button", { name: "Save and spin" }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Save draft as a new wheel" }).click();

  const titles = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null")
    .wheels.map((wheel: { title: string }) => wheel.title));
  expect(titles).toContain("Latest saved wheel");
  expect(titles).toContain("Stale local draft (copy)");
});

test("a stale generator draft can be reloaded without silently discarding it", async ({ page, context }) => {
  await page.goto("/chains/demo_chain_fantasy_story/edit");
  const draftTitle = page.getByRole("textbox", { name: "Title", exact: true });
  await draftTitle.fill("Stale generator draft");

  const writer = await context.newPage();
  await writer.goto("/chains/demo_chain_fantasy_story/edit");
  await writer.getByRole("textbox", { name: "Title", exact: true }).fill("Latest generator");
  await writer.getByRole("button", { name: "Save chain" }).first().click();

  await expect(page.getByRole("alert")).toContainText("This generator changed in another tab");
  await expect(draftTitle).toHaveValue("Stale generator draft");
  await page.getByRole("button", { name: "Reload latest version" }).click();
  await expect(draftTitle).toHaveValue("Latest generator");
});
