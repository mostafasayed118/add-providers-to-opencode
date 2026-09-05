"use client";

import { CapabilityFieldset } from "@/components/CapabilityFieldset";
import { Field, inputClass } from "@/components/form-fields";
import { ProviderSelect } from "@/components/ProviderSelect";
import { useProviderForm, type ProviderType } from "@/hooks/useProviderForm";

const PROVIDER_TYPES = [
  { v: "openai-compatible", t: "OpenAI-compatible", d: "Any OpenAI-style /v1 endpoint" },
  { v: "custom", t: "Custom", d: "Custom provider id + same protocol" },
] as const;

export default function Home() {
  const form = useProviderForm();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Opencode Provider Setup
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter your endpoint, key, and model. On submit we validate and
            write the global opencode config automatically.
          </p>
        </header>

        <form onSubmit={form.submit} noValidate className="space-y-5">
          <ProviderSelect
            providers={form.providers}
            selected={form.selected}
            onChange={form.handleSelectChange}
          />

          {form.selectedProvider && form.selectedProvider.models.length > 0 && (
            <div>
              <label htmlFor="model_sel" className="mb-1 block text-sm font-medium">
                Model to edit
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
                <option value="__new_model">+ New model…</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Other models on this provider are left untouched.
              </p>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Provider type</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDER_TYPES.map((o) => (
                <label
                  key={o.v}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                    form.providerType === o.v
                      ? "border-blue-600 bg-blue-50"
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
                  <span className="font-medium">{o.t}</span>
                  <span className="block text-xs text-slate-500">{o.d}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {form.providerType === "custom" && (
            <Field label="Provider ID" htmlFor="providerId" error={form.errors.providerId}>
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

          <Field
            label="Base URL"
            htmlFor="base_url"
            error={form.errors.base_url}
            hint={
              form.errors.base_url
                ? undefined
                : "https required, except localhost / LAN."
            }
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
            label="API Key"
            htmlFor="api_key"
            error={form.errors.api_key}
            hint={
              !form.errors.api_key && form.selectedProvider?.hasKey
                ? "Leave blank to keep the stored key, or type a new one to replace it."
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                aria-pressed={form.showKey}
              >
                {form.showKey ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          <Field label="Model ID" htmlFor="model_id" error={form.errors.model_id}>
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
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.testing === "testing" ? "Testing…" : "Test connection"}
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
            values={{
              contextLimit: form.contextLimit,
              outputLimit: form.outputLimit,
              toolCall: form.toolCall,
              reasoning: form.reasoning,
              attachment: form.attachment,
            }}
            errors={form.errors}
            onChange={(patch) => {
              if (patch.contextLimit !== undefined) form.setContextLimit(patch.contextLimit);
              if (patch.outputLimit !== undefined) form.setOutputLimit(patch.outputLimit);
              if (patch.toolCall !== undefined) form.setToolCall(patch.toolCall);
              if (patch.reasoning !== undefined) form.setReasoning(patch.reasoning);
              if (patch.attachment !== undefined) form.setAttachment(patch.attachment);
            }}
          />

          {form.errors._form && (
            <div
              role={form.status === "success" ? "status" : "alert"}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {form.errors._form}
            </div>
          )}

          {form.status === "success" && form.result && (
            <div
              role="status"
              className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900"
            >
              <p className="font-medium">Saved. Opencode will use it automatically.</p>
              <p className="mt-1 break-all">Model: {form.result.model}</p>
              <p className="break-all">File: {form.result.path}</p>
              {form.result.backup && (
                <p className="break-all">Backup: {form.result.backup}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={form.status === "saving"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.status === "saving" ? "Saving…" : "Submit & Apply to Opencode"}
            </button>
            <button
              type="button"
              onClick={form.loadCurrent}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Load current
            </button>
            <button
              type="button"
              onClick={form.reset}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          {form.selectedProvider && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              {form.deleting === "confirm" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <p className="flex-1 text-sm text-red-900">
                    Delete provider “{form.selectedProvider.id}” and all its models?
                  </p>
                  <button
                    type="button"
                    onClick={form.confirmDelete}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setDeleting("idle")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
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
                    ? "Deleting…"
                    : `Delete provider “${form.selectedProvider.id}”…`}
                </button>
              )}
            </div>
          )}
        </form>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Writes global ~/.config/opencode/opencode.json and sets top-level model.
      </p>
    </main>
  );
}
