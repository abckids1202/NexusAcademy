import { expect, test } from "@playwright/test";

test("undoing the latest elimination spin restores its option and removes the history entry", async ({ page }) => {
  await page.goto("/wheels/new");
  await page.getByLabel("Title").fill("Undoable elimination wheel");
  await page.getByLabel("Spin behavior").selectOption("elimination");
  await page.getByLabel("Spin duration").fill("1800");
  await page.getByRole("button", { name: "Save and spin" }).first().click();

  const optionRows = page.getByRole("list", { name: "Options and chances" }).getByRole("listitem");
  await expect(optionRows).toHaveCount(3);
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(optionRows).toHaveCount(2);
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo latest spin for Undoable elimination wheel" }).click();

  await expect(optionRows).toHaveCount(3);
  await expect(page.locator(".history-row")).toHaveCount(0);
  await expect(page.locator(".status-note")).toContainText("Undid the last spin:");
});

test("wheel CSV import previews weighted rows and preserves duplicate entries", async ({ page }) => {
  await page.goto("/wheels/new");
  const csvInput = page.locator(".file-button input[type=file]");
  await csvInput.setInputFiles({
    name: "wheel-options.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Option,Weight\nPizza,3\nSushi,1\npizza,2\n,4\nSoup,0\n"),
  });

  const preview = page.getByRole("region", { name: "CSV option preview" });
  await expect(preview.getByText("3 valid options", { exact: true })).toBeVisible();
  await expect(preview.getByText("2 invalid rows")).toBeVisible();
  await expect(preview.getByText("1 repeated labels will be kept as separate entries, preserving their combined chance.")).toBeVisible();
  await preview.getByRole("button", { name: "Add 3 valid options" }).click();
  await expect(page.locator(".option-editor-row")).toHaveCount(6);

  await page.getByLabel("Title").fill("CSV weighted options");
  await page.getByRole("button", { name: "Save and spin" }).first().click();
  const wheel = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.wheels.find((item: { title: string }) => item.title === "CSV weighted options");
  });
  expect(wheel.options.slice(-3).map((item: { label: string; weight: number }) => [item.label, item.weight])).toEqual([
    ["Pizza", 3], ["Sushi", 1], ["pizza", 2],
  ]);
});

test("multi-winner draws preserve duplicate-ticket odds, export the list, and undo as one batch", async ({ page }) => {
  await page.goto("/wheels/new");
  await page.getByLabel("Title").fill("Multi winner raffle");
  const labels = page.locator(".option-editor-row input.text-field");
  await labels.nth(0).fill("Avery");
  await labels.nth(1).fill("avery");
  await labels.nth(2).fill("Jordan");
  await page.getByRole("button", { name: "Save and spin" }).first().click();

  await expect(page.getByLabel("Number of winners")).toHaveAttribute("max", "2");
  await page.getByRole("button", { name: "Draw 2 winners" }).click();
  const winnerList = page.locator(".winner-draw-history");
  await expect(winnerList.getByRole("listitem")).toHaveCount(2);
  const winnerLabels = await winnerList.locator("li > span:nth-child(2)").allTextContents();
  expect(winnerLabels.map((label) => label.toLowerCase()).sort()).toEqual(["avery", "jordan"]);
  await expect(winnerList).toContainText("% at pick 1");
  await expect(winnerList).toContainText("% at pick 2");

  const download = page.waitForEvent("download");
  await winnerList.getByRole("button", { name: "Download winner list" }).click();
  expect((await download).suggestedFilename()).toBe("multi-winner-raffle-winners.txt");

  const unchanged = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null")
    .wheels.find((wheel: { title: string }) => wheel.title === "Multi winner raffle").options.every((option: { isRemoved: boolean }) => !option.isRemoved));
  expect(unchanged).toBe(true);
  await page.getByRole("button", { name: "Undo latest winner draw for Multi winner raffle" }).click();
  await expect(winnerList).toHaveCount(0);
  const savedDrawResults = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null")
    .spinResults.filter((result: { drawId?: string }) => result.drawId).length);
  expect(savedDrawResults).toBe(0);
});
