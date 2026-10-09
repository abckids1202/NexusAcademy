import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("cloud backup is optional and local settings remain available", async ({ page }) => {
  await page.goto("/settings");
  const cloudCard = page.locator(".shell-card").filter({ has: page.getByRole("heading", { name: "Private cloud backup" }) });
  await expect(cloudCard).toBeVisible();
  await expect(page.getByRole("button", { name: "Export full backup" })).toBeVisible();

  const setupMessage = cloudCard.getByText("Cloud backup is not configured in this deployment.");
  if (await setupMessage.count()) {
    await expect(setupMessage).toBeVisible();
    await expect(cloudCard.getByLabel("Email")).toHaveCount(0);
  } else {
    await expect(cloudCard.getByLabel("Email")).toBeVisible();
    await expect(cloudCard.getByLabel("Password")).toBeVisible();
  }
});

test("history cleanup removes saved results without removing active generator sessions", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Clear saved history" })).toBeVisible();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    data.spinResults = [{
      id: "cleanup-result", wheelId: data.wheels[0].id, wheelTitle: data.wheels[0].title,
      optionId: data.wheels[0].options[0].id, resultLabel: data.wheels[0].options[0].label,
      resultColor: "#fff", resultWeight: 1, resultChance: 1, specialType: "normal",
      createdAt: new Date().toISOString(), spinIndex: 1,
    }];
    data.chainSessions = [
      { id: "active-session", chainId: "active-chain", chainTitle: "Active story", status: "in_progress", results: [], startedAt: new Date().toISOString() },
      { id: "completed-session", chainId: "completed-chain", chainTitle: "Finished story", status: "completed", results: [], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
    ];
    localStorage.setItem("wheelforge_data_v1", JSON.stringify(data));
  });
  await page.reload();

  let confirmedMessage = "";
  page.once("dialog", async (dialog) => {
    confirmedMessage = dialog.message();
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Clear saved history" }).click();
  expect(confirmedMessage).toContain("Active generator sessions will remain resumable");
  await expect(page.getByRole("status")).toContainText("Cleared 1 spin result and 1 completed generator session");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null"));
  expect(saved.spinResults).toEqual([]);
  expect(saved.chainSessions.map((session: { id: string }) => session.id)).toEqual(["active-session"]);
});

test("invalid stored workspace is preserved and Settings offers raw export, backup recovery, or confirmed reset", async ({ page }) => {
  await page.goto("/settings");
  const [backupDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export full backup" }).click(),
  ]);
  const backupText = await readFile((await backupDownload.path())!, "utf8");
  const backup = JSON.parse(backupText) as Record<string, unknown>;
  const invalidRaw = JSON.stringify({ ...backup, wheels: [null] });
  await page.evaluate((raw) => localStorage.setItem("wheelforge_data_v1", raw), invalidRaw);
  await page.reload();

  await expect(page.locator(".storage-warning")).toContainText("invalid and has been preserved");
  await page.getByRole("link", { name: "Open settings" }).click();
  const recovery = page.getByRole("region", { name: "Recover damaged workspace" });
  await expect(recovery).toBeVisible();
  await expect(page.getByRole("button", { name: "Export full backup" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Restore demo data" })).toBeDisabled();

  const [rawDownload] = await Promise.all([
    page.waitForEvent("download"),
    recovery.getByRole("button", { name: "Download preserved raw data" }).click(),
  ]);
  expect(await readFile((await rawDownload.path())!, "utf8")).toBe(invalidRaw);

  const backupInput = page.locator(".file-button input[type=file]");
  await backupInput.setInputFiles({
    name: "valid-recovery.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupText),
  });
  await expect(page.getByRole("heading", { name: "Review backup" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge into this browser" })).toHaveCount(0);
  await page.getByRole("button", { name: "Replace existing data" }).click();
  await expect(page.getByRole("status")).toContainText("Backup restored:");
  await expect(page.getByRole("region", { name: "Recover damaged workspace" })).toHaveCount(0);

  await page.evaluate((raw) => localStorage.setItem("wheelforge_data_v1", raw), invalidRaw);
  await page.reload();
  await page.getByRole("link", { name: "Open settings" }).click();
  let resetConfirmed = false;
  page.once("dialog", async (dialog) => {
    resetConfirmed = dialog.message().includes("Reset all WheelForge data");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Reset all local data" }).click();
  expect(resetConfirmed).toBe(true);
  await expect(page.getByRole("region", { name: "Recover damaged workspace" })).toHaveCount(0);
  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null"));
  expect(reset.wheels).toEqual([]);
  expect(reset.chains).toEqual([]);
});

test("backup export round-trips the workspace and invalid imports never prompt or replace data", async ({ page }) => {
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export full backup" }).click(),
  ]);
  const exportedText = await readFile((await download.path())!, "utf8");
  const exported = JSON.parse(exportedText) as {
    version: number;
    wheels: unknown[];
    chains: unknown[];
    settings: { theme: string };
  };
  expect(exported.version).toBe(1);
  expect(exported.wheels.length).toBeGreaterThan(0);
  expect(exported.chains.length).toBeGreaterThan(0);

  const theme = page.getByLabel("Theme");
  const originalTheme = exported.settings.theme;
  const changedTheme = originalTheme === "light" ? "dark" : "light";
  await theme.selectOption(changedTheme);
  await expect(theme).toHaveValue(changedTheme);

  const backupInput = page.locator(".file-button input[type=file]");
  await backupInput.setInputFiles({
    name: "wheelforge-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedText),
  });

  await expect(page.getByRole("heading", { name: "Review backup" })).toBeVisible();
  await expect(page.getByText(/Replace restores everything, including preferences/)).toBeVisible();
  await page.getByRole("button", { name: "Replace existing data" }).click();
  await expect(page.getByRole("status")).toContainText(`Backup restored: ${exported.wheels.length} wheels and ${exported.chains.length} generators.`);
  await expect(theme).toHaveValue(originalTheme);
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null"));
  expect(restored.wheels).toEqual(exported.wheels);
  expect(restored.chains).toEqual(exported.chains);

  let unexpectedConfirmation = false;
  page.once("dialog", async (dialog) => {
    unexpectedConfirmation = true;
    await dialog.dismiss();
  });
  await backupInput.setInputFiles({
    name: "not-a-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("status")).toContainText("That file is not a valid WheelForge backup.");
  expect(unexpectedConfirmation).toBe(false);
  await expect(theme).toHaveValue(originalTheme);
  const afterInvalidImport = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null"));
  expect(afterInvalidImport.wheels).toEqual(exported.wheels);
  expect(afterInvalidImport.chains).toEqual(exported.chains);
});

test("backup merge previews collisions and refreshes its review after a second-tab write", async ({ page }) => {
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export full backup" }).click(),
  ]);
  const backup = JSON.parse(await readFile((await download.path())!, "utf8")) as {
    wheels: Array<{ id: string; title: string; options: Array<{ id: string }> }>;
  };
  const sourceWheel = backup.wheels[0];
  backup.wheels.push({
    ...sourceWheel,
    id: "imported-only-wheel",
    title: "Imported only",
    options: sourceWheel.options.map((option, index) => ({ ...option, id: `imported-only-option-${index + 1}` })),
  });

  const theme = page.getByLabel("Theme");
  const changedTheme = (await theme.inputValue()) === "light" ? "dark" : "light";
  await theme.selectOption(changedTheme);
  const backupInput = page.locator(".file-button input[type=file]");
  await backupInput.setInputFiles({
    name: "wheelforge-merge.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("heading", { name: "Review backup" })).toBeVisible();
  await expect(page.getByText(/matching IDs keep the current records/)).toContainText("ID conflicts found.");

  const secondTab = await page.context().newPage();
  await secondTab.goto("/");
  await secondTab.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const source = data.wheels[0];
    data.wheels.push({
      ...source,
      id: "second-tab-wheel",
      title: "Created in second tab",
      options: source.options.map((option: { id: string }, index: number) => ({ ...option, id: `second-tab-option-${index + 1}` })),
    });
    localStorage.setItem("wheelforge_data_v1", JSON.stringify(data));
  });

  await page.getByRole("button", { name: "Merge into this browser" }).click();
  await expect(page.getByRole("status")).toContainText("workspace changed");
  await expect(page.getByRole("heading", { name: "Review backup" })).toBeVisible();
  await page.getByRole("button", { name: "Merge into this browser" }).click();

  const merged = await page.evaluate(() => JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null"));
  expect(merged.settings.theme).toBe(changedTheme);
  expect(merged.wheels.find((wheel: { id: string }) => wheel.id === "imported-only-wheel").title).toBe("Imported only");
  expect(merged.wheels.find((wheel: { id: string }) => wheel.id === "second-tab-wheel").title).toBe("Created in second tab");
  await expect(page.getByRole("status")).toContainText("Backup merged:");
});
