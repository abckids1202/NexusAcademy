import { expect, test } from "@playwright/test";

test("a saved wheel template makes independent copies and can be renamed and deleted", async ({ page }) => {
  await page.goto("/dashboard");
  const sourceRow = page.locator(".project-row").filter({ hasText: "Food Picker" }).first();
  const sourceWheelPath = await sourceRow.getByRole("link", { name: "Edit Food Picker" }).getAttribute("href");
  expect(sourceWheelPath).toBeTruthy();
  const sourceWheelId = sourceWheelPath!.split("/")[2];
  page.once("dialog", (dialog) => dialog.accept("Quick Lunch Choices"));
  await sourceRow.getByRole("button", { name: "Save Food Picker as a template" }).click();

  await page.goto("/templates");
  await page.reload();
  await page.getByRole("button", { name: "My templates (1)" }).click();
  const savedTemplate = page.locator(".template-item").filter({ has: page.getByRole("heading", { name: "Quick Lunch Choices" }) });
  await expect(savedTemplate).toBeVisible();
  const templateOptionIds = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.userTemplates[0].wheel.options.map((option: { id: string }) => option.id);
  });
  const originalOptionLabel = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.userTemplates[0].wheel.options[0].label;
  });

  await savedTemplate.getByRole("button", { name: "Use template" }).click();
  await expect(page).toHaveURL(/\/wheels\/[^/]+\/edit$/);
  await expect(page.getByLabel("Title")).toHaveValue("Quick Lunch Choices");
  const copiedWheelId = new URL(page.url()).pathname.split("/")[2];
  const copiedOptionIds = await page.evaluate((wheelId) => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.wheels.find((wheel: { id: string }) => wheel.id === wheelId).options.map((option: { id: string }) => option.id);
  }, copiedWheelId);
  expect(copiedOptionIds).not.toEqual(templateOptionIds);

  await page.getByLabel("Title").fill("Edited one-off wheel");
  await page.getByRole("button", { name: "Save and spin" }).first().click();
  await page.goto("/templates");
  await page.getByRole("button", { name: "My templates (1)" }).click();
  await expect(page.getByRole("heading", { name: "Quick Lunch Choices" })).toBeVisible();

  await page.goto(`/wheels/${sourceWheelId}/edit`);
  await page.locator(".option-editor-row input.text-field").first().fill("Updated lunch choice");
  await page.getByRole("button", { name: "Save and spin" }).first().click();
  await page.goto("/templates");
  await page.getByRole("button", { name: "My templates (1)" }).click();
  const templateAfterSourceEdit = page.locator(".template-item").filter({ has: page.getByRole("heading", { name: "Quick Lunch Choices" }) });
  await templateAfterSourceEdit.getByText("Replace snapshot").click();
  await templateAfterSourceEdit.getByLabel("Replacement source for Quick Lunch Choices").selectOption({ label: "Food Picker" });
  page.once("dialog", (dialog) => dialog.accept());
  await templateAfterSourceEdit.getByRole("button", { name: "Replace from saved wheel" }).click();

  const replacedTemplateState = await page.evaluate(({ copiedWheelId }) => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const template = data.userTemplates.find((item: { title: string }) => item.title === "Quick Lunch Choices");
    const existingCopy = data.wheels.find((wheel: { id: string }) => wheel.id === copiedWheelId);
    return {
      templateId: template.id,
      title: template.title,
      optionLabel: template.wheel.options[0].label,
      optionIds: template.wheel.options.map((option: { id: string }) => option.id),
      copyTitle: existingCopy.title,
      copyOptionLabel: existingCopy.options[0].label,
    };
  }, { copiedWheelId });
  expect(replacedTemplateState.title).toBe("Quick Lunch Choices");
  expect(replacedTemplateState.optionLabel).toBe("Updated lunch choice");
  expect(replacedTemplateState.optionIds).toEqual(templateOptionIds);
  expect(replacedTemplateState.copyTitle).toBe("Edited one-off wheel");
  expect(replacedTemplateState.copyOptionLabel).toBe(originalOptionLabel);

  page.once("dialog", (dialog) => dialog.accept("Renamed Lunch Template"));
  await page.getByRole("button", { name: "Rename Quick Lunch Choices" }).click();
  await expect(page.getByRole("heading", { name: "Renamed Lunch Template" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Renamed Lunch Template" }).click();
  await page.getByRole("button", { name: "My templates (0)" }).click();
  await expect(page.getByRole("status")).toContainText("No templates match");
});

test("a saved generator template clones its dependent wheels and keeps step references valid", async ({ page }) => {
  await page.goto("/dashboard");
  const sourceRow = page.locator(".project-row").filter({ hasText: "Fantasy Story Generator" }).first();
  page.once("dialog", (dialog) => dialog.accept("My Story Generator"));
  await sourceRow.getByRole("button", { name: "Save Fantasy Story Generator as a template" }).click();

  await page.goto("/templates");
  await page.getByRole("button", { name: "My templates (1)" }).click();
  const savedTemplate = page.locator(".template-item").filter({ has: page.getByRole("heading", { name: "My Story Generator" }) });
  await savedTemplate.getByRole("button", { name: "Use template" }).click();
  await expect(page).toHaveURL(/\/chains\/[^/]+\/run$/);
  await expect(page.getByRole("heading", { name: "My Story Generator" })).toBeVisible();

  const copiedChainId = new URL(page.url()).pathname.split("/")[2];
  const result = await page.evaluate((chainId) => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const template = data.userTemplates[0];
    const chain = data.chains.find((item: { id: string }) => item.id === chainId);
    const copiedWheelIds = new Set(data.wheels.map((wheel: { id: string }) => wheel.id));
    return {
      sourceWheelIds: template.wheels.map((wheel: { id: string }) => wheel.id),
      copiedSteps: chain.steps,
      wheelIds: [...copiedWheelIds],
    };
  }, copiedChainId);
  expect(result.copiedSteps).toHaveLength(4);
  for (const step of result.copiedSteps) {
    expect(result.wheelIds).toContain(step.wheelId);
    expect(result.sourceWheelIds).not.toContain(step.wheelId);
  }
});

test("template search, category filters, and favorites persist while creating a wheel copy", async ({ page }) => {
  await page.goto("/templates");
  const foodTemplate = page.locator(".template-item").filter({ has: page.getByRole("heading", { name: "Food Picker" }) });

  await foodTemplate.getByRole("button", { name: "Add Food Picker to favorites" }).click();
  await expect(foodTemplate.getByRole("button", { name: "Remove Food Picker from favorites" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();

  await page.getByRole("button", { name: "Favorites (1)" }).click();
  await expect(page.locator(".template-item")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search templates" }).fill("Sushi");
  await expect(page.getByRole("heading", { name: "Food Picker" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search templates" }).fill("");
  await page.getByLabel("Category").selectOption("giveaway");
  await expect(page.getByRole("status")).toContainText("No templates match");
  await page.getByLabel("Category").selectOption("all");

  await page.locator(".template-item").getByRole("button", { name: "Use template" }).click();
  await expect(page).toHaveURL(/\/wheels\/[^/]+\/edit$/);
  await expect(page.getByLabel("Title")).toHaveValue("Food Picker");

  await page.goto("/templates");
  await page.getByRole("button", { name: "Recent (1)" }).click();
  await expect(page.locator(".template-item")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Food Picker" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Recent (1)" }).click();
  await expect(page.locator(".template-item")).toHaveCount(1);
});

test("using a generator template records the generator, not each component wheel, as recent", async ({ page }) => {
  await page.goto("/templates");
  await page.getByRole("button", { name: "Generators" }).click();
  const generator = page.locator(".template-item").filter({ has: page.getByRole("heading", { name: "Fantasy Story Generator" }) });
  await generator.getByRole("button", { name: "Create generator" }).click();
  await expect(page).toHaveURL(/\/chains\/[^/]+\/run$/);

  await page.goto("/templates");
  await page.getByRole("button", { name: "Recent (1)" }).click();
  await expect(page.locator(".template-item")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Fantasy Story Generator" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fantasy Factions" })).toHaveCount(0);
});
