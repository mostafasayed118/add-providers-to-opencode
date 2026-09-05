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
  await expect(page.getByRole("dialog", { name: "Review changes" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm & Apply" }).click();
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

test("theme toggle switches dark class and persists", async ({ page }) => {  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle dark mode" });
  await toggle.click();
  await expect(page.locator("html.dark")).toBeAttached();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "dark"
  );
  await page.reload();
  await expect(page.locator("html.dark")).toBeAttached();
  // Theme change cross-fades via CSS transitions; let it settle first.
  await page.waitForTimeout(500);
  const bg = await page.evaluate(() =>
    getComputedStyle(document.getElementById("base_url")!).backgroundColor
  );
  expect(bg).toBe("rgb(15, 23, 42)");
  await page.screenshot({ path: "shots/dark.png" });
});

test("backups list paginates", async ({ page }) => {  await page.goto("/");
  await page.fill("#base_url", "https://api.example.com/v1");
  await page.fill("#api_key", "sk-e2e-test-key-123");
  await page.fill("#model_id", "pager-model");
  // Seven saves guarantee at least six backups (first write has nothing to back up).
  for (let i = 0; i < 7; i++) {
    await page.getByRole("button", { name: "Submit & Apply to Opencode" }).click();
    await expect(page.getByRole("dialog", { name: "Review changes" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm & Apply" }).click();
    await expect(page.getByText("Saved. Opencode will use it automatically.")).toBeVisible();
  }
  const backupsCard = page.locator("div.rounded-2xl", {
    has: page.locator("h2", { hasText: "Backups" }),
  });
  await expect(backupsCard.getByText(/Page 1 of \d+/)).toBeVisible();
  const pager = page.getByRole("navigation", { name: "Backups" });
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page
      .locator("div.rounded-2xl", { has: page.locator("h2", { hasText: "Backups" }) })
      .getByText(/Page 2 of \d+/)
  ).toBeVisible();
  await pager.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page
      .locator("div.rounded-2xl", { has: page.locator("h2", { hasText: "Backups" }) })
      .getByText(/Page 1 of \d+/)
  ).toBeVisible();
  await page.locator("div.rounded-2xl", { has: page.locator("h2", { hasText: "Backups" }) }).screenshot({ path: "shots/backups-pager.png" });
});

test("preview shows the diff and back-to-edit cancels", async ({ page }) => {
  await page.goto("/");
  await page.fill("#base_url", "https://preview.example.com/v1");
  await page.fill("#api_key", "sk-e2e-test-key-123");
  await page.fill("#model_id", "preview-model");
  await page.getByRole("button", { name: "Submit & Apply to Opencode" }).click();
  const dialog = page.getByRole("dialog", { name: "Review changes" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("preview-model").first()).toBeVisible();
  // Secrets must never render in the diff, even though the user just typed one.
  await expect(dialog.getByText("sk-e2e-test-key-123")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to edit" }).click();
  await expect(dialog).not.toBeVisible();
  // Nothing was written: the previewed model must not appear in the dropdown.
  await expect(
    page.locator("#existing_provider option", { hasText: "preview-model" })
  ).toHaveCount(0);
});

test("provider search filters the dropdown", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Search providers…").fill("e2eprov");
  await expect(page.locator('#existing_provider option[value="e2eprov"]')).toBeAttached();
  await page.getByPlaceholder("Search providers…").fill("zzz-no-such-provider");
  await expect(page.locator("#existing_provider option")).toHaveCount(1);
});

test("doctor runs and history lists saves", async ({ page }) => {  await page.goto("/");
  await page.getByRole("button", { name: "Run checks" }).click();
  // Either a clean bill or reported issues — both prove the check ran.
  await expect(
    page.getByText(/No issues found\.|has no context limit|has no API key|does not match/).first()
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator("h2", { hasText: "Change history" })).toBeVisible();
  await expect(page.getByText("save", { exact: true }).first()).toBeVisible();
});

test("doctor and history paginate", async ({ page, request }) => {
  // Seed seven models without limits: 7 history entries + 7 limit warnings.
  for (let i = 0; i < 7; i++) {
    const res = await request.post("/api/save-provider", {
      data: {
        base_url: "https://api.example.com/v1",
        api_key: "sk-e2e-test-key-123",
        model_id: `pageseed-${i}`,
        providerType: "custom",
        providerId: "pageseed",
      },
    });
    expect(res.ok()).toBe(true);
  }
  await page.goto("/");
  const doctorCard = page.locator("div.rounded-2xl", {
    has: page.locator("h2", { hasText: "Config health" }),
  });
  await expect(doctorCard.getByText(/Page 1 of \d+/)).toBeVisible();
  await doctorCard.getByRole("button", { name: "Next", exact: true }).click();
  await expect(doctorCard.getByText(/Page 2 of \d+/)).toBeVisible();

  const historyCard = page.locator("div.rounded-2xl", {
    has: page.locator("h2", { hasText: "Change history" }),
  });
  await expect(historyCard.getByText(/Page 1 of \d+/)).toBeVisible();
  await historyCard.getByRole("button", { name: "Next", exact: true }).click();
  await expect(historyCard.getByText(/Page 2 of \d+/)).toBeVisible();
});

test("gate toggle, keyboard submit and bulk delete", async ({ page, request }) => {
  for (const pid of ["bulkdel-1", "bulkdel-2"]) {
    const res = await request.post("/api/save-provider", {
      data: {
        base_url: "https://api.example.com/v1",
        api_key: "sk-e2e-test-key-123",
        model_id: "m",
        providerType: "custom",
        providerId: pid,
      },
    });
    expect(res.ok()).toBe(true);
  }
  await page.goto("/");
  await page.selectOption("#existing_provider", "bulkdel-1");
  await page.getByRole("radio", { name: "Disabled" }).click();
  await expect(page.getByRole("radio", { name: "Disabled" })).toBeChecked();

  // Ctrl+Enter opens the preview; Escape closes it.
  await page.selectOption("#existing_provider", "__new");
  await page.fill("#base_url", "https://kb.example.com/v1");
  await page.fill("#api_key", "sk-e2e-test-key-123");
  await page.fill("#model_id", "kb-model");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("dialog", { name: "Review changes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Review changes" })).not.toBeVisible();

  // Bulk delete both seeded providers.
  await page.getByLabel(/bulkdel-1/).check();
  await page.getByLabel(/bulkdel-2/).check();
  await page.getByRole("button", { name: /Delete selected \(2\)/ }).click();
  await page.getByRole("button", { name: /Delete selected \(2\)/ }).click();
  await expect(page.getByText(/Deleted 2 providers/)).toBeVisible();
  await expect(page.locator('#existing_provider option[value="bulkdel-1"]')).toHaveCount(0);
});

test("export redacts secrets; keyless import is rejected", async ({ page, request }) => {
  await page.goto("/");
  const portability = page.locator("div.rounded-2xl", {
    has: page.locator("h2", { hasText: "Export pack" }),
  });
  const dl = page.waitForEvent("download");
  await portability.getByRole("button", { name: "Export pack", exact: true }).click();
  const download = await dl;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const text = (await import("node:fs")).readFileSync(filePath, "utf8");
  expect(text).not.toMatch(/sk-e2e-test-key-123/);
  expect(text).toMatch(/"providers"/);

  const bad = await request.post("/api/import", {
    data: { providers: { p1: { options: { baseURL: "https://x.example.com" }, models: { m: {} } } } },
  });
  expect(bad.status()).toBe(400);
  const good = await request.post("/api/import", {
    data: {
      providers: {
        imp1: {
          options: { baseURL: "https://imp.example.com", apiKey: "sk-imp-key-123" },
          models: { m: { name: "m" } },
        },
      },
    },
  });
  expect(good.ok()).toBe(true);
});

test("custom target roundtrips through its own file", async ({ page, request }) => {
  const { default: path } = await import("node:path");
  const customPath = path.join(process.cwd(), ".e2e-home", "custom-e2e.json");
  const target = { kind: "custom", path: customPath };
  const save = await request.post("/api/save-provider", {
    data: {
      target,
      base_url: "https://api.example.com/v1",
      api_key: "sk-e2e-test-key-123",
      model_id: "m1",
      providerType: "custom",
      providerId: "customfile",
    },
  });
  expect(save.ok()).toBe(true);
  const cur = await request.get(`/api/current-config?t=${encodeURIComponent(JSON.stringify(target))}`);
  const body = await cur.json();
  expect(body.model).toBe("customfile/m1");
  const global = await (await request.get("/api/current-config")).json();
  expect(global.model).not.toBe("customfile/m1");
  await page.goto("/");
});

test("draft survives reload without the secret", async ({ page }) => {
  await page.goto("/");
  await page.fill("#base_url", "https://draft.example.com/v1");
  await page.fill("#api_key", "sk-draft-secret-123");
  await page.fill("#model_id", "draft-model");
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator("#base_url")).toHaveValue("https://draft.example.com/v1");
  await expect(page.locator("#model_id")).toHaveValue("draft-model");
  await expect(page.locator("#api_key")).toHaveValue("");
});

test("verify-all reports unreachable endpoints", async ({ page, request }) => {
  for (const pid of ["dead-1", "dead-2"]) {
    await request.post("/api/save-provider", {
      data: {
        base_url: "http://127.0.0.1:9/v1",
        api_key: "sk-e2e-test-key-123",
        model_id: "m",
        providerType: "custom",
        providerId: pid,
      },
    });
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Verify all endpoints" }).click();
  await expect(page.getByText(/\d+ of \d+ endpoints reachable/)).toBeVisible({ timeout: 60000 });
  const deadRow = page.locator("li", { hasText: "dead-1" });
  await expect(deadRow.getByText(/Could not reach|HTTP/)).toBeVisible();
});

test("copy button copies the model ref and cards collapse", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.fill("#base_url", "https://api.example.com/v1");
  await page.fill("#api_key", "sk-e2e-test-key-123");
  await page.fill("#model_id", "copy-model");
  await page.getByRole("button", { name: "Submit & Apply to Opencode" }).click();
  await page.getByRole("button", { name: "Confirm & Apply" }).click();
  await expect(page.getByText("Saved. Opencode will use it automatically.")).toBeVisible();
  await page.getByRole("button", { name: /Copy custom\/copy-model/ }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("custom/copy-model");
  const historyCard = page.locator("div.rounded-2xl", {
    has: page.locator("h2", { hasText: "Change history" }),
  });
  await historyCard.getByRole("button", { name: "Change history" }).click();
  await expect(historyCard.getByText("Every save")).not.toBeVisible();
});
