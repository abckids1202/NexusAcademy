import { expect, test } from "@playwright/test";

test("an interrupted generator chain resumes its saved session at the next step", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/chains/demo_chain_fantasy_story/run");
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Faction" })).toBeVisible();

  await page.getByRole("button", { name: "Spin the wheel" }).click();
  const resultDialog = page.getByRole("dialog");
  await expect(resultDialog).toBeVisible();
  const firstResult = (await resultDialog.getByRole("heading").textContent())?.trim();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await expect(page.locator(".chain-result-row")).toHaveCount(1);

  const sessionBeforeReload = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.chainSessions.find((session: { chainId: string; status?: string }) =>
      session.chainId === "demo_chain_fantasy_story" && session.status === "in_progress");
  });
  expect(sessionBeforeReload).toBeDefined();
  expect(sessionBeforeReload.results).toHaveLength(1);

  await page.reload();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Character" })).toBeVisible();
  await expect(page.locator(".chain-result-row")).toHaveCount(1);
  await expect(page.locator(".chain-result-row")).toContainText(firstResult!);

  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Step 3 of 4")).toBeVisible();

  const sessionAfterResume = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.chainSessions.find((session: { chainId: string; status?: string }) =>
      session.chainId === "demo_chain_fantasy_story" && session.status === "in_progress");
  });
  expect(sessionAfterResume.id).toBe(sessionBeforeReload.id);
  expect(sessionAfterResume.results).toHaveLength(2);
});
