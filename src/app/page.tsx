"use client";

import { useEffect, useState } from "react";
import { CapabilityFieldset } from "@/components/CapabilityFieldset";
import { Field, SectionLabel, inputClass, secondaryBtn, selectClass } from "@/components/form-fields";
import { Pager, PAGE_SIZE } from "@/components/Pager";
import { ProviderSelect } from "@/components/ProviderSelect";
import { useProviderForm, type ProviderType } from "@/hooks/useProviderForm";
import { PRESETS } from "@/lib/presets";
import { strings, type Locale } from "@/i18n";

const PROVIDER_TYPES = [
  { v: "openai-compatible", tKey: "typeOpenAI", dKey: "typeOpenAIDesc" },
  { v: "custom", tKey: "typeCustom", dKey: "typeCustomDesc" },
] as const;

const STORAGE_OPTIONS = [
  { v: "inline", tKey: "keyStorageInline", dKey: "keyStorageInlineDesc" },
  { v: "env", tKey: "keyStorageEnv", dKey: "keyStorageEnvDesc" },
  { v: "file", tKey: "keyStorageFile", dKey: "keyStorageFileDesc" },
] as const;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [backupPage, setBackupPage] = useState(0);
  const [doctorPage, setDoctorPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [providerQuery, setProviderQuery] = useState("");
  const t = strings[locale];
  const form = useProviderForm(t);

  const filteredProviders = form.providers.filter(
    (p) =>
      !providerQuery.trim() ||
      p.id.toLowerCase().includes(providerQuery.trim().toLowerCase()) ||
      p.models.some((m) => m.id.toLowerCase().includes(providerQuery.trim().toLowerCase()))
  );

  const BACKUP_PAGE_SIZE = PAGE_SIZE;
  const backupTotalPages = Math.max(1, Math.ceil(form.backups.length / BACKUP_PAGE_SIZE));
  const safeBackupPage = Math.min(backupPage, backupTotalPages - 1);
  const visibleBackups = form.backups.slice(
    safeBackupPage * BACKUP_PAGE_SIZE,
    safeBackupPage * BACKUP_PAGE_SIZE + BACKUP_PAGE_SIZE
  );
  const doctorTotalPages = Math.max(1, Math.ceil(form.issues.length / PAGE_SIZE));
  const safeDoctorPage = Math.min(doctorPage, doctorTotalPages - 1);
  const visibleIssues = form.issues.slice(
    safeDoctorPage * PAGE_SIZE,
    safeDoctorPage * PAGE_SIZE + PAGE_SIZE
  );
  const historyTotalPages = Math.max(1, Math.ceil(form.history.length / PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages - 1);
  const visibleHistory = form.history.slice(
    safeHistoryPage * PAGE_SIZE,
    safeHistoryPage * PAGE_SIZE + PAGE_SIZE
  );

  useEffect(() => {
    setBackupPage(0);
  }, [form.backups.length]);

  useEffect(() => {
    setDoctorPage(0);
  }, [form.issues.length]);

  useEffect(() => {
    setHistoryPage(0);
  }, [form.history.length]);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    applyTheme(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTheme(v: "light" | "dark") {
    setTheme(v);
    document.documentElement.classList.toggle("dark", v === "dark");
    try {
      localStorage.setItem("theme", v);
    } catch {
      // Private mode etc: theme just won't persist.
    }
  }

  return (
    <main
      dir={t.dir}
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10"
    >
      <div className="animate-enter rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-black/40 dark:ring-slate-800 sm:p-8">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => applyTheme(theme === "light" ? "dark" : "light")}
              title={t.toggleTheme}
              aria-label={t.toggleTheme}
              aria-pressed={theme === "dark"}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold transition duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => setLocale((l) => (l === "en" ? "ar" : "en"))}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold transition duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t.toggleLang}
            </button>
          </div>
        </header>

        {form.showOnboarding && (
          <div role="status" className="animate-enter mb-5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
            <p>{t.onboarding(form.providers.length, form.activeModel)}</p>
            <div className="mt-2 flex gap-2">
              {form.activeModel && (
                <button
                  type="button"
                  onClick={form.loadActiveModel}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-semibold text-white transition duration-200 hover:bg-blue-700 active:scale-[0.98]"
                >
                  {t.loadActive}
                </button>
              )}
              <button
                type="button"
                onClick={() => form.setOnboardDismissed(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                {t.startFresh}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={form.submit} noValidate className="space-y-5">
          <SectionLabel n="01">{t.provider}</SectionLabel>
          <div>
            <input
              aria-label={t.searchProviders}
              placeholder={t.searchProviders}
              value={providerQuery}
              onChange={(e) => setProviderQuery(e.target.value)}
              autoComplete="off"
              className={`${inputClass(false)} mb-2`}
            />
            <ProviderSelect
              t={t}
              providers={filteredProviders}
              selected={form.selected}
              onChange={form.handleSelectChange}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t.presets}</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => form.applyPreset(p)}
                  title={p.baseURL}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium transition duration-200 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {form.selectedProvider && form.selectedProvider.models.length > 0 && (
            <div>
              <label htmlFor="model_sel" className="mb-1 block text-sm font-medium">
                {t.modelToEdit}
              </label>
              <select
                id="model_sel"
                value={form.modelSel}
                onChange={(e) => form.handleModelChange(e.target.value)}
                className={selectClass}
              >
                {form.selectedProvider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
                <option value="__new_model">{t.newModel}</option>
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.otherModelsKept}</p>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t.providerType}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDER_TYPES.map((o) => (
                <label
                  key={o.v}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition duration-200 active:scale-[0.99] ${
                    form.providerType === o.v
                      ? "border-blue-600 bg-blue-50 shadow-sm shadow-blue-900/10 dark:bg-blue-950"
                      : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="providerType"
                    value={o.v}
                    checked={form.providerType === o.v}
                    onChange={() => form.setProviderType(o.v as ProviderType)}
                    className="mr-2 accent-blue-600"
                  />
                  <span className="font-medium">{t[o.tKey]}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t[o.dKey]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {form.providerType === "custom" && (
            <Field label={t.providerId} htmlFor="providerId" error={form.errors.providerId}>
              <input
                id="providerId"
                value={form.providerId}
                onChange={(e) => form.setProviderId(e.target.value)}
                placeholder="custom"
                autoComplete="off"
                aria-invalid={Boolean(form.errors.providerId)}
                aria-describedby={form.errors.providerId ? "providerId-error" : undefined}
                className={inputClass(Boolean(form.errors.providerId))}
              />
            </Field>
          )}

          <SectionLabel n="02">{t.sectionCredentials}</SectionLabel>
          <Field
            label={t.baseUrl}
            htmlFor="base_url"
            error={form.errors.base_url}
            hint={form.errors.base_url ? undefined : t.baseUrlHint}
          >
            <input
              id="base_url"
              inputMode="url"
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(e) => form.setBaseUrl(e.target.value)}
              onBlur={() => form.touched && form.runValidation()}
              aria-invalid={Boolean(form.errors.base_url)}
              aria-describedby={form.errors.base_url ? "base_url-error" : undefined}
              className={inputClass(Boolean(form.errors.base_url))}
            />
          </Field>

          <Field
            label={t.apiKey}
            htmlFor="api_key"
            error={form.errors.api_key}
            hint={
              !form.errors.api_key && form.selectedProvider?.hasKey
                ? t.keepKeyHint
                : undefined
            }
          >
            <div className="relative">
              <input
                id="api_key"
                type={form.showKey ? "text" : "password"}
                placeholder="sk-..."
                value={form.apiKey}
                onChange={(e) => form.setApiKey(e.target.value)}
                onBlur={() => form.touched && form.runValidation()}
                autoComplete="off"
                aria-invalid={Boolean(form.errors.api_key)}
                aria-describedby={form.errors.api_key ? "api_key-error" : undefined}
                className={`${inputClass(Boolean(form.errors.api_key))} pr-16`}
              />
              <button
                type="button"
                onClick={() => form.setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-600 transition duration-200 hover:bg-slate-100 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-pressed={form.showKey}
              >
                {form.showKey ? t.hide : t.show}
              </button>
            </div>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t.keyStorage}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STORAGE_OPTIONS.map((o) => (
                <label
                  key={o.v}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition duration-200 active:scale-[0.99] ${
                    form.keyStorage === o.v
                      ? "border-blue-600 bg-blue-50 shadow-sm shadow-blue-900/10 dark:bg-blue-950"
                      : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="keyStorage"
                    value={o.v}
                    checked={form.keyStorage === o.v}
                    onChange={() => form.setKeyStorage(o.v)}
                    className="mr-2 accent-blue-600"
                  />
                  <span className="font-medium">{t[o.tKey]}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t[o.dKey]}</span>
                </label>
              ))}
            </div>
            {form.keyStorage === "env" && (
              <div className="mt-2">
                <Field label={t.keyEnvName} htmlFor="key_env_name">
                  <input
                    id="key_env_name"
                    placeholder="RUNINFRA_API_KEY"
                    value={form.keyEnvName}
                    onChange={(e) => form.setKeyEnvName(e.target.value)}
                    autoComplete="off"
                    dir="ltr"
                    className={inputClass(false)}
                  />
                </Field>
              </div>
            )}
            {form.keyStorage === "file" && (
              <div className="mt-2">
                <Field label={t.keyFile} htmlFor="key_file">
                  <input
                    id="key_file"
                    placeholder="~/.config/opencode/keys/testyy.key"
                    value={form.keyFile}
                    onChange={(e) => form.setKeyFile(e.target.value)}
                    autoComplete="off"
                    dir="ltr"
                    className={inputClass(false)}
                  />
                </Field>
              </div>
            )}
          </fieldset>

          <SectionLabel n="03">{t.sectionModel}</SectionLabel>
          <Field label={t.modelId} htmlFor="model_id" error={form.errors.model_id}>
            <input
              id="model_id"
              list="model-suggestions"
              placeholder="gpt-4o-mini"
              value={form.modelId}
              onChange={(e) => form.setModelId(e.target.value)}
              onBlur={() => form.touched && form.runValidation()}
              autoComplete="off"
              aria-invalid={Boolean(form.errors.model_id)}
              aria-describedby={form.errors.model_id ? "model_id-error" : undefined}
              className={inputClass(Boolean(form.errors.model_id))}
            />
            <datalist id="model-suggestions">
              {form.discovered.map((id) => (
                <option key={`d-${id}`} value={id} />
              ))}
              {(form.selectedProvider?.models ?? []).map((m) => (
                <option key={`m-${m.id}`} value={m.id} />
              ))}
            </datalist>
          </Field>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={form.testConnection}
              disabled={form.testing === "testing"}
              className={secondaryBtn}
            >
              {form.testing === "testing" ? t.testing : t.testConnection}
            </button>
            <button
              type="button"
              onClick={form.testPrompt}
              disabled={form.promptState === "testing"}
              title={t.promptHint}
              className={secondaryBtn}
            >
              {form.promptState === "testing" ? t.promptTesting : t.testPrompt}
            </button>
          </div>
          {form.testMsg && (
            <p
              role={form.testing === "ok" ? "status" : "alert"}
              className={`mt-1 text-sm ${
                form.testing === "ok"
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {form.testMsg}
            </p>
          )}
          {form.promptMsg && (
            <p
              role={form.promptState === "ok" ? "status" : "alert"}
              className={`mt-1 break-all text-sm ${
                form.promptState === "ok"
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {form.promptMsg}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.promptHint}</p>

          <CapabilityFieldset
            t={t}
            values={{
              contextLimit: form.contextLimit,
              outputLimit: form.outputLimit,
              toolCall: form.toolCall,
              reasoning: form.reasoning,
              attachment: form.attachment,
              reasoningField: form.reasoningField,
            }}
            errors={form.errors}
            onChange={(patch) => {
              if (patch.contextLimit !== undefined) form.setContextLimit(patch.contextLimit);
              if (patch.outputLimit !== undefined) form.setOutputLimit(patch.outputLimit);
              if (patch.toolCall !== undefined) form.setToolCall(patch.toolCall);
              if (patch.reasoning !== undefined) form.setReasoning(patch.reasoning);
              if (patch.attachment !== undefined) form.setAttachment(patch.attachment);
              if (patch.reasoningField !== undefined) form.setReasoningField(patch.reasoningField);
            }}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t.headers}</legend>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t.headersHint}</p>
            <div className="space-y-2">
              {form.headerRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    aria-label={t.headerName}
                    placeholder={t.headerName}
                    value={row.name}
                    onChange={(e) =>
                      form.setHeaderRows(
                        form.headerRows.map((r, j) =>
                          j === i ? { ...r, name: e.target.value } : r
                        )
                      )
                    }
                    autoComplete="off"
                    dir="ltr"
                    className={inputClass(false)}
                  />
                  <input
                    aria-label={t.headerValue}
                    placeholder={t.headerValue}
                    type="password"
                    value={row.value}
                    onChange={(e) =>
                      form.setHeaderRows(
                        form.headerRows.map((r, j) =>
                          j === i ? { ...r, value: e.target.value } : r
                        )
                      )
                    }
                    autoComplete="off"
                    dir="ltr"
                    className={inputClass(false)}
                  />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() =>
                      form.setHeaderRows(form.headerRows.filter((_, j) => j !== i))
                    }
                    className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm transition duration-200 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => form.setHeaderRows([...form.headerRows, { name: "", value: "" }])}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {t.addHeader}
              </button>
            </div>
          </fieldset>

          <Field
            label={t.smallModel}
            htmlFor="small_model"
            error={form.errors.small_model}
            hint={t.smallModelHint(form.storedSmallModel)}
          >
            <input
              id="small_model"
              placeholder="provider/model"
              value={form.smallModel}
              onChange={(e) => form.setSmallModel(e.target.value)}
              autoComplete="off"
              dir="ltr"
              className={inputClass(false)}
            />
          </Field>

          {form.errors._form && (
            <div
              role={form.status === "success" ? "status" : "alert"}
              className="animate-enter rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
              {form.errors._form}
            </div>
          )}

          {form.status === "success" && form.result && (
            <div
              role="status"
              className="animate-enter rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
            >
              <p className="font-medium">{t.saved}</p>
              <p className="mt-1 break-all font-mono text-[13px]">{t.savedModel(form.result.model)}</p>
              <p className="break-all font-mono text-[13px]">{t.savedFile(form.result.path)}</p>
              {form.result.backup && (
                <p className="break-all font-mono text-[13px]">{t.savedBackup(form.result.backup)}</p>
              )}
              {form.result.notice && <p className="mt-1 break-all">{form.result.notice}</p>}
            </div>
          )}

          {form.preview && (
            <div
              role="dialog"
              aria-label={t.previewTitle}
              className="animate-enter rounded-lg border border-blue-300 bg-blue-50/50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/40"
            >
              <p className="text-sm font-semibold">
                {t.previewTitle} — <span className="font-mono">{form.preview.model}</span>
              </p>
              {form.preview.changed ? (
                <div className="mt-2 max-h-64 space-y-3 overflow-auto">
                  {form.preview.sections.map((s) => (
                    <div key={s.title}>
                      <p dir="ltr" className="text-left font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {s.title}
                      </p>
                      <pre
                        dir="ltr"
                        className="mt-1 overflow-auto rounded-lg bg-white p-2 text-left font-mono text-xs leading-relaxed ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800"
                      >
                        {s.lines.map((l, i) => (
                          <div
                            key={i}
                            className={
                              l.type === "add"
                                ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
                                : l.type === "del"
                                  ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                                  : "text-slate-500 dark:text-slate-400"
                            }
                          >
                            <span className="mr-2 inline-block w-3 select-none opacity-60">
                              {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
                            </span>
                            {l.text}
                          </div>
                        ))}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t.previewNoChanges}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={form.confirmSubmit}
                  disabled={form.status === "saving"}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-blue-900/20 transition duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {form.status === "saving" ? t.saving : t.confirmApply}
                </button>
                <button
                  type="button"
                  onClick={() => form.setPreview(null)}
                  className={secondaryBtn}
                >
                  {t.backToEdit}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="mr-3"><span className="font-semibold text-green-700 dark:text-green-400">+ {t.previewAdded}</span></span>
                <span className="font-semibold text-red-700 dark:text-red-400">− {t.previewRemoved}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={form.status === "saving" || form.previewing}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-blue-900/20 transition duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.previewing ? t.previewing : form.status === "saving" ? t.saving : t.submit}
            </button>
            <button
              type="button"
              onClick={form.loadCurrent}
              className={secondaryBtn}
            >
              {t.loadCurrent}
            </button>
            <button
              type="button"
              onClick={form.reset}
              className={secondaryBtn}
            >
              {t.reset}
            </button>
          </div>

          {form.selectedProvider && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={form.cloneSelected}
                disabled={form.cloning}
                className={secondaryBtn}
              >
                {form.cloning ? t.cloning : t.clone}
              </button>
            </div>
          )}

          {form.selectedProvider && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
              {form.deleting === "confirm" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <p className="flex-1 text-sm text-red-900 dark:text-red-100">
                    {t.deleteConfirm(form.selectedProvider.id)}
                  </p>
                  <button
                    type="button"
                    onClick={form.confirmDelete}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-red-700 active:scale-[0.98]"
                  >
                    {t.deleteYes}
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setDeleting("idle")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    {t.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => form.setDeleting("confirm")}
                  disabled={form.deleting === "busy"}
                  className="text-sm font-medium text-red-700 hover:text-red-900 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                >
                  {form.deleting === "busy"
                    ? t.deleting
                    : t.deleteProvider(form.selectedProvider.id)}
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-black/40 dark:ring-slate-800 sm:p-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
            <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">04</span>
            {t.backups}
          </h2>
          {form.backups.length > 0 && (
            <button
              type="button"
              onClick={form.undoLast}
              disabled={form.restoring !== null}
              title={t.backupsHint}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {form.restoring ? t.restoring : t.undoLast}
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.backupsHint}</p>
        {form.backups.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.noBackups}</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {visibleBackups.map((b) => (
              <li
                key={b.file}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
              >
                <span className="flex-1 break-all">
                  <span dir="ltr" className="inline-block font-mono text-[13px]">{b.file}</span>{" "}
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    ({formatBytes(b.bytes)}
                    {b.kind === "corrupt" ? `, ${t.corruptBadge}` : ""})
                  </span>
                </span>
                <button
                  type="button"
                  disabled={form.restoring !== null}
                  onClick={() => form.restore(b.file)}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                >
            {form.restoring === b.file ? t.restoring : t.restore}
                </button>
              </li>
            ))}
          </ul>
          <Pager
            label={t.backups}
            page={safeBackupPage}
            totalPages={backupTotalPages}
            prevLabel={t.backupsPrev}
            nextLabel={t.backupsNext}
            pageLabel={t.backupsPage}
            onPrev={() => setBackupPage((p) => Math.max(0, p - 1))}
            onNext={() => setBackupPage((p) => Math.min(backupTotalPages - 1, p + 1))}
          />
          </>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-black/40 dark:ring-slate-800 sm:p-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
            <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">05</span>
            {t.doctor}
          </h2>
          <button
            type="button"
            onClick={form.loadDoctor}
            disabled={form.doctorState !== "idle"}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {form.doctorState === "idle" ? t.doctorCheck : form.doctorState === "checking" ? t.doctorChecking : t.fixing}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.doctorHint}</p>
        {form.issues.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.noIssues}</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {visibleIssues.map((issue) => (
              <li
                key={issue.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  issue.level === "error"
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                    : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                }`}
              >
                <span className="flex-1">{issue.message}</span>
                {issue.fixable && (
                  <button
                    type="button"
                    disabled={form.doctorState !== "idle"}
                    onClick={() => form.fixIssue(issue.id)}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    {t.fix}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Pager
            label={t.doctor}
            page={safeDoctorPage}
            totalPages={doctorTotalPages}
            prevLabel={t.pagerPrev}
            nextLabel={t.pagerNext}
            pageLabel={t.pagerPage}
            onPrev={() => setDoctorPage((p) => Math.max(0, p - 1))}
            onNext={() => setDoctorPage((p) => Math.min(doctorTotalPages - 1, p + 1))}
          />
          </>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-black/40 dark:ring-slate-800 sm:p-8">
        <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
          <span className="font-mono text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">06</span>
          {t.history}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.historyHint}</p>
        {form.history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.noHistory}</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {visibleHistory.map((h, i) => (
              <li
                key={`${h.ts}-${safeHistoryPage * PAGE_SIZE + i}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
              >
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-800">
                  {h.action}
                </span>
                <span className="flex-1 break-all font-mono text-[13px]">
                  {[h.provider, h.model].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {new Date(h.ts).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          <Pager
            label={t.history}
            page={safeHistoryPage}
            totalPages={historyTotalPages}
            prevLabel={t.pagerPrev}
            nextLabel={t.pagerNext}
            pageLabel={t.pagerPage}
            onPrev={() => setHistoryPage((p) => Math.max(0, p - 1))}
            onNext={() => setHistoryPage((p) => Math.min(historyTotalPages - 1, p + 1))}
          />
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">{t.footer}</p>
    </main>
  );
}
