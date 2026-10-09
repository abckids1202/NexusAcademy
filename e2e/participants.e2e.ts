import { expect, test } from "@playwright/test";

test("participant directory creates, searches, edits, and archives reusable profiles", async ({ page }) => {
  await page.goto("/participants");
  await page.getByLabel("Name").fill("Avery Chen");
  await page.getByLabel(/Email/).fill("avery@example.com");
  await page.getByLabel(/Group or team/).fill("Blue team");
  await page.getByRole("button", { name: "Add participant" }).click();

  await expect(page.getByRole("status")).toContainText("Participant added");
  await expect(page.getByText("Avery Chen")).toBeVisible();
  await expect(page.getByText("Blue team · avery@example.com · Active")).toBeVisible();

  await page.getByPlaceholder("Search name, group, or notes").fill("avery");
  await expect(page.locator(".participant-directory-list .project-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit Avery Chen" }).click();
  await page.getByLabel("Name").fill("Avery Rivera");
  await page.getByRole("button", { name: "Save participant" }).click();
  await expect(page.getByText("Avery Rivera", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Archive Avery Rivera" }).click();
  await expect(page.locator(".participant-directory-list .project-row")).toHaveCount(0);
  await page.getByLabel("Show archived").check();
  await expect(page.getByText("Avery Rivera", { exact: true })).toBeVisible();
  await expect(page.getByText(/Archived/)).toBeVisible();
});

test("tournament creation can add active directory participants", async ({ page }) => {
  await page.goto("/participants");
  await page.getByLabel("Name").fill("Jordan Lee");
  await page.getByLabel(/Group or team/).fill("Blue team");
  await page.getByRole("button", { name: "Add participant" }).click();
  await page.getByLabel("Name").fill("Sam Ortiz");
  await page.getByLabel(/Group or team/).fill("Gold team");
  await page.getByRole("button", { name: "Add participant" }).click();

  await page.goto("/tournaments");
  const savedParticipants = page.getByLabel("Saved participants");
  const jordanOption = savedParticipants.locator("option").filter({ hasText: "Jordan Lee" });
  await savedParticipants.selectOption((await jordanOption.getAttribute("value")) ?? "");
  await page.getByRole("button", { name: "Add selected participants" }).click();
  await expect(page.getByLabel(/Participants/)).toHaveValue("Jordan Lee");
  await expect(page.getByRole("button", { name: "Preview tournament" })).toBeDisabled();
  const samOption = savedParticipants.locator("option").filter({ hasText: "Sam Ortiz" });
  await savedParticipants.selectOption((await samOption.getAttribute("value")) ?? "");
  await page.getByRole("button", { name: "Add selected participants" }).click();
  await expect(page.getByLabel(/Participants/)).toHaveValue("Jordan Lee\nSam Ortiz");
  await page.getByLabel("Role for Jordan Lee").fill("Captain");
  await page.getByLabel("Seat for Jordan Lee").fill("7");
  await page.getByLabel("Seat for Sam Ortiz").fill("2");
  await page.getByLabel("Tournament name").fill("Directory metadata cup");
  await page.getByLabel("Seeding").selectOption("manual");
  await page.getByRole("button", { name: "Preview tournament" }).click();
  await expect(page.getByRole("region", { name: "Tournament preview" })).toContainText("Blue team");
  await expect(page.getByRole("region", { name: "Tournament preview" })).toContainText("Gold team");
  await expect(page.getByRole("region", { name: "Tournament preview" })).toContainText("Captain · Seat 7");
});

test("wheel creation can add active directory participants without duplicates", async ({ page }) => {
  await page.goto("/participants");
  await page.getByLabel("Name").fill("Riley Morgan");
  await page.getByRole("button", { name: "Add participant" }).click();
  await page.getByLabel("Name").fill("Casey Wong");
  await page.getByRole("button", { name: "Add participant" }).click();

  await page.goto("/wheels/new");
  await page.getByRole("checkbox", { name: "Riley Morgan" }).check();
  await page.getByRole("checkbox", { name: "Casey Wong" }).check();
  await page.getByRole("button", { name: "Add 2 participants" }).click();

  const optionInputs = page.locator(".option-editor-row input.text-field");
  await expect(optionInputs).toHaveCount(5);
  await expect(optionInputs.nth(0)).toHaveValue("Option A");
  await expect(optionInputs.nth(1)).toHaveValue("Option B");
  await expect(optionInputs.nth(2)).toHaveValue("Option C");
  await expect(optionInputs.nth(3)).toHaveValue("Casey Wong");
  await expect(optionInputs.nth(4)).toHaveValue("Riley Morgan");
  await expect(page.getByRole("checkbox", { name: "Riley Morgan" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Casey Wong" })).toBeDisabled();
});
