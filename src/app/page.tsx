"use client";

import { useState } from "react";
import { CapabilityFieldset } from "@/components/CapabilityFieldset";
import { Field, SectionLabel, inputClass } from "@/components/form-fields";
import { ProviderSelect } from "@/components/ProviderSelect";
import { useProviderForm, type ProviderType } from "@/hooks/useProviderForm";
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
  const t = strings[locale];
  const form = useProviderForm(t);

  return (
    <main
      dir={t.dir}
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10"
    >
      <div className="animate-enter rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-200 sm:p-8">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setLocale((l) => (l === "en" ? "ar" : "en"))}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold transition duration-200 hover:bg-slate-50 active:scale-[0.98]"
          >
            {t.toggleLang}
          </button>
        </header>

        {form.showOnboarding && (
          <div role="status" className="animate-enter mb-5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
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
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98]"
              >
                {t.startFresh}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={form.submit} noValidate className="space-y-5">
          <SectionLabel n="01">{t.provider}</SectionLabel>
          <ProviderSelect
            t={t}
            providers={form.providers}
            selected={form.selected}
            onChange={form.handleSelectChange}
          />

          {form.selectedProvider && form.selectedProvider.models.length > 0 && (
            <div>
              <label htmlFor="model_sel" className="mb-1 block text-sm font-medium">
                {t.modelToEdit}
              </label>
              <select
                id="model_sel"
                value={form.modelSel}
                onChange={(e) => form.handleModelChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {form.selectedProvider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
                <option value="__new_model">{t.newModel}</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">{t.otherModelsKept}</p>
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
                      ? "border-blue-600 bg-blue-50 shadow-sm shadow-blue-900/10"
                      : "border-slate-300 hover:border-slate-400"
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
                  <span className="block text-xs text-slate-500">{t[o.dKey]}</span>
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-600 transition duration-200 hover:bg-slate-100 active:scale-95"
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
                      ? "border-blue-600 bg-blue-50 shadow-sm shadow-blue-900/10"
                      : "border-slate-300 hover:border-slate-400"
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
                  <span className="block text-xs text-slate-500">{t[o.dKey]}</span>
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

          <div>
            <button
              type="button"
              onClick={form.testConnection}
              disabled={form.testing === "testing"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.testing === "testing" ? t.testing : t.testConnection}
            </button>
            {form.testMsg && (
              <p
                role={form.testing === "ok" ? "status" : "alert"}
                className={`mt-1 text-sm ${
                  form.testing === "ok" ? "text-green-700" : "text-red-600"
                }`}
              >
                {form.testMsg}
              </p>
            )}
          </div>

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
            <p className="mb-2 text-xs text-slate-500">{t.headersHint}</p>
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
                    className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => form.setHeaderRows([...form.headerRows, { name: "", value: "" }])}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium hover:bg-slate-50"
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
              className="animate-enter rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {form.errors._form}
            </div>
          )}

          {form.status === "success" && form.result && (
            <div
              role="status"
              className="animate-enter rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900"
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={form.status === "saving"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-blue-900/20 transition duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.status === "saving" ? t.saving : t.submit}
            </button>
            <button
              type="button"
              onClick={form.loadCurrent}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98]"
            >
              {t.loadCurrent}
            </button>
            <button
              type="button"
              onClick={form.reset}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98]"
            >
              {t.reset}
            </button>
          </div>

          {form.selectedProvider && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              {form.deleting === "confirm" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <p className="flex-1 text-sm text-red-900">
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
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    {t.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => form.setDeleting("confirm")}
                  disabled={form.deleting === "busy"}
                  className="text-sm font-medium text-red-700 hover:text-red-900 disabled:opacity-60"
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

      <div className="mt-4 rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/10 ring-1 ring-slate-200 sm:p-8">
        <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
          <span className="font-mono text-sm font-semibold tabular-nums text-blue-600">04</span>
          {t.backups}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.backupsHint}</p>
        {form.backups.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t.noBackups}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {form.backups.slice(0, 10).map((b) => (
              <li
                key={b.file}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="flex-1 break-all">
                  <span dir="ltr" className="inline-block font-mono text-[13px]">{b.file}</span>{" "}
                  <span className="text-xs tabular-nums text-slate-500">
                    ({formatBytes(b.bytes)}
                    {b.kind === "corrupt" ? `, ${t.corruptBadge}` : ""})
                  </span>
                </span>
                <button
                  type="button"
                  disabled={form.restoring !== null}
                  onClick={() => form.restore(b.file)}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
                >
                  {form.restoring === b.file ? t.restoring : t.restore}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">{t.footer}</p>
    </main>
  );
}
