import { test, expect } from "@playwright/test";

test("new provider: fill, validate, submit, then edit it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Opencode Provider Setup" })).toBeVisible();

  // Empty submit flags all three required fields.
  await page.getByRole("button", { name: "Submit & Apply to Opencode" }).click();
  await expect(page.locator("#base_url-error")).toBeVisible();
  await expect(page.locator("#api_key-error")).toBeVisible();
  await expect(page.locator("#model_id-error")).toBeVisible();

  // Fill and submit a valid custom provider.
  await page.selectOption("#existing_provider", "__new");
  await page.locator('input[name="providerType"][value="custom"]').check();
  await page.fill("#providerId", "e2eprov");
  await page.fill("#base_url", "https://api.example.com/v1");
  await page.fill("#api_key", "sk-e2e-test-key-123");
  await page.fill("#model_id", "e2e-model");
  await page.fill("#context_limit", "12345");
  await page.getByLabel("Attachments (images)").check();
  await page.getByRole("button", { name: "Submit & Apply to Opencode" }).click();
  await expect(page.getByText("Saved. Opencode will use it automatically.")).toBeVisible();
  await expect(page.getByText("Model: e2eprov/e2e-model")).toBeVisible();

  // Provider appears in the dropdown; selecting it loads values back.
  await expect(page.locator('#existing_provider option[value="e2eprov"]')).toBeAttached();
  await page.selectOption("#existing_provider", "e2eprov");
  await expect(page.locator("#base_url")).toHaveValue("https://api.example.com/v1");
  await expect(page.locator("#model_id")).toHaveValue("e2e-model");
  await expect(page.locator("#context_limit")).toHaveValue("12345");
});

test("arabic toggle flips layout direction", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "عربي" }).click();
  await expect(page.locator("main[dir='rtl']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "إعداد مزوّد Opencode" })).toBeVisible();
});
