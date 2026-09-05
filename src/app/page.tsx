"use client";

import { useCallback, useEffect, useState } from "react";

type ProviderType = "openai-compatible" | "custom";

type ProviderModelSummary = {
  id: string;
  name: string | null;
  tool_call: boolean;
  reasoning: boolean;
  attachment: boolean;
  limit: { context?: number; output?: number } | null;
};

type ProviderSummary = {
  id: string;
  name: string | null;
  baseURL: string | null;
  hasKey: boolean;
  models: ProviderModelSummary[];
};

type FieldErrors = Partial<
  Record<"base_url" | "api_key" | "model_id" | "providerId" | "context_limit" | "output_limit" | "_form", string>
>;

type SaveSuccess = { path: string; model: string; backup: string | null };

const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const PROVIDER_RE = /^[a-z0-9-]{1,32}$/;

function validateLocal(values: {
  base_url: string;
  api_key: string;
  model_id: string;
  providerType: ProviderType;
  providerId: string;
  context_limit: string;
  output_limit: string;
  requireKey: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};
  const baseUrl = values.base_url.trim();
  if (!baseUrl) {
    errors.base_url = "base_url is required.";
  } else {
    let u: URL | null = null;
    try {
      u = new URL(baseUrl);
    } catch {
      errors.base_url = "Enter a valid URL (e.g. https://api.example.com/v1).";
    }
    if (u) {
      const isHttps = u.protocol === "https:";
      const host = u.hostname.toLowerCase();
      const local =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local") ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);
      if (!isHttps && !local) {
        errors.base_url = "Use https, except for localhost / private LAN.";
      }
    }
  }
  if (!values.api_key.trim()) {
    if (values.requireKey) errors.api_key = "api_key is required.";
  } else if (values.api_key.trim().length < 8)
    errors.api_key = "api_key must be at least 8 characters.";
  const model = values.model_id.trim();
  if (!model) errors.model_id = "model_id is required.";
  else if (!MODEL_RE.test(model))
    errors.model_id = "Letters, numbers, . _ : / - only (no spaces).";
  if (values.providerType === "custom") {
    const pid = values.providerId.trim().toLowerCase();
    if (!pid) errors.providerId = "Provider id is required for custom.";
    else if (!PROVIDER_RE.test(pid))
      errors.providerId = "Lowercase letters, numbers, dash only.";
  }
  for (const key of ["context_limit", "output_limit"] as const) {
    const raw = values[key].trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0 || n > 10000000) {
      errors[key] = "Enter a positive whole number up to 10000000, or leave blank.";
    }
  }
  return errors;
}

export default function Home() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("openai-compatible");
  const [providerId, setProviderId] = useState("custom");
  const [contextLimit, setContextLimit] = useState("");
  const [outputLimit, setOutputLimit] = useState("");
  const [toolCall, setToolCall] = useState(true);
  const [reasoning, setReasoning] = useState(false);
  const [attachment, setAttachment] = useState(false);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selected, setSelected] = useState<string>("__new");
  const selectedProvider = providers.find((p) => p.id === selected) ?? null;

  useEffect(() => {
    fetch("/api/current-config")
      .then((r) => r.json())
      .then((d: { ok: boolean; providers?: ProviderSummary[] }) => {
        if (d.ok && Array.isArray(d.providers)) setProviders(d.providers);
      })
      .catch(() => {});
  }, []);

  function loadProvider(p: ProviderSummary) {
    setSelected(p.id);
    setProviderType(p.id === "custom" ? "openai-compatible" : "custom");
    setProviderId(p.id);
    setBaseUrl(p.baseURL ?? "");
    setApiKey("");
    const m = p.models[0];
    setModelId(m?.id ?? "");
    setToolCall(m?.tool_call ?? true);
    setReasoning(m?.reasoning ?? false);
    setAttachment(m?.attachment ?? false);
    setContextLimit(m?.limit?.context != null ? String(m.limit.context) : "");
    setOutputLimit(m?.limit?.output != null ? String(m.limit.output) : "");
    setErrors({});
    setResult(null);
    setStatus("idle");
    setTouched(false);
  }

  function handleSelectChange(id: string) {
    if (id === "__new") {
      handleReset();
      return;
    }
    const p = providers.find((x) => x.id === id);
    if (p) loadProvider(p);
  }
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [result, setResult] = useState<SaveSuccess | null>(null);
  const [touched, setTouched] = useState(false);

  const runValidation = useCallback(() => {
    const next = validateLocal({
      base_url: baseUrl,
      api_key: apiKey,
      model_id: modelId,
      providerType,
      providerId,
      context_limit: contextLimit,
      output_limit: outputLimit,
      requireKey: !selectedProvider?.hasKey,
    });
    setErrors(next);
    return next;
  }, [baseUrl, apiKey, modelId, providerType, providerId, contextLimit, outputLimit, selectedProvider]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setResult(null);
    const next = runValidation();
    if (Object.keys(next).length > 0) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrors({});
    try {
      const res = await fetch("/api/save-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: baseUrl.trim().replace(/\/+$/, ""),
          api_key: apiKey.trim(),
          model_id: modelId.trim(),
          providerType,
          providerId: providerId.trim().toLowerCase() || "custom",
          ...(contextLimit.trim() ? { context_limit: Number(contextLimit.trim()) } : {}),
          ...(outputLimit.trim() ? { output_limit: Number(outputLimit.trim()) } : {}),
          tool_call: toolCall,
          reasoning,
          attachment,
        }),
      });
      const data = (await res.json()) as
        | (SaveSuccess & { ok: true })
        | { ok: false; errors: FieldErrors };
      if (!res.ok || !data.ok) {
        setErrors((data as { errors?: FieldErrors }).errors ?? { _form: "Save failed." });
        setStatus("error");
        return;
      }
      setResult({ path: data.path, model: data.model, backup: data.backup });
      setStatus("success");
    } catch {
      setErrors({ _form: "Network error. Is the app server running?" });
      setStatus("error");
    }
  }

  async function handleLoadCurrent() {
    setErrors({});
    try {
      const res = await fetch("/api/current-config");
      const data = (await res.json()) as {
        ok: boolean;
        exists: boolean;
        path: string;
        model: string | null;
      };
      if (!data.ok) throw new Error("read failed");
      setErrors(
        data.exists
          ? { _form: `Current model: ${data.model ?? "(none)"} @ ${data.path}` }
          : { _form: `No global config yet. It will be created at ${data.path}` }
      );
      setStatus("error");
    } catch {
      setErrors({ _form: "Could not load current config." });
      setStatus("error");
    }
  }

  function handleReset() {
    setSelected("__new");
    setBaseUrl("");
    setApiKey("");
    setModelId("");
    setProviderType("openai-compatible");
    setProviderId("custom");
    setContextLimit("");
    setOutputLimit("");
    setToolCall(true);
    setReasoning(false);
    setAttachment(false);
    setErrors({});
    setResult(null);
    setStatus("idle");
    setTouched(false);
  }

  const fieldClass = (hasError: boolean) =>
    `w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 ${
      hasError
        ? "border-red-500 focus:ring-red-200"
        : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
    }`;

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

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="existing_provider" className="mb-1 block text-sm font-medium">
              Provider
            </label>
            <select
              id="existing_provider"
              value={selected}
              onChange={(e) => handleSelectChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="__new">+ New provider…</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                  {p.models[0] ? ` — ${p.models[0].id}` : ""}
                  {p.models.length > 1 ? ` (+${p.models.length - 1} more)` : ""}
                </option>
              ))}
            </select>
            {selectedProvider && selectedProvider.models.length > 1 && (
              <p className="mt-1 text-xs text-slate-500">
                Editing the first model; other models on this provider are left untouched.
              </p>
            )}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Provider type</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  { v: "openai-compatible", t: "OpenAI-compatible", d: "Any OpenAI-style /v1 endpoint" },
                  { v: "custom", t: "Custom", d: "Custom provider id + same protocol" },
                ] as const
              ).map((o) => (
                <label
                  key={o.v}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                    providerType === o.v
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="providerType"
                    value={o.v}
                    checked={providerType === o.v}
                    onChange={() => setProviderType(o.v)}
                    className="mr-2 accent-blue-600"
                  />
                  <span className="font-medium">{o.t}</span>
                  <span className="block text-xs text-slate-500">{o.d}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {providerType === "custom" && (
            <div>
              <label htmlFor="providerId" className="mb-1 block text-sm font-medium">
                Provider ID
              </label>
              <input
                id="providerId"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                placeholder="custom"
                autoComplete="off"
                aria-invalid={Boolean(errors.providerId)}
                aria-describedby={errors.providerId ? "providerId-error" : undefined}
                className={fieldClass(Boolean(errors.providerId))}
              />
              {errors.providerId && (
                <p id="providerId-error" role="alert" className="mt-1 text-sm text-red-600">
                  {errors.providerId}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="base_url" className="mb-1 block text-sm font-medium">
              Base URL
            </label>
            <input
              id="base_url"
              inputMode="url"
              placeholder="https://api.example.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onBlur={() => touched && runValidation()}
              aria-invalid={Boolean(errors.base_url)}
              aria-describedby={errors.base_url ? "base_url-error" : undefined}
              className={fieldClass(Boolean(errors.base_url))}
            />
            {errors.base_url ? (
              <p id="base_url-error" role="alert" className="mt-1 text-sm text-red-600">
                {errors.base_url}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">https required, except localhost / LAN.</p>
            )}
          </div>

          <div>
            <label htmlFor="api_key" className="mb-1 block text-sm font-medium">
              API Key
            </label>
            <div className="relative">
              <input
                id="api_key"
                type={showKey ? "text" : "password"}
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => touched && runValidation()}
                autoComplete="off"
                aria-invalid={Boolean(errors.api_key)}
                aria-describedby={errors.api_key ? "api_key-error" : undefined}
                className={`${fieldClass(Boolean(errors.api_key))} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                aria-pressed={showKey}
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            {errors.api_key && (
              <p id="api_key-error" role="alert" className="mt-1 text-sm text-red-600">
                {errors.api_key}
              </p>
            )}
            {!errors.api_key && selectedProvider?.hasKey && (
              <p className="mt-1 text-xs text-slate-500">
                Leave blank to keep the stored key, or type a new one to replace it.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="model_id" className="mb-1 block text-sm font-medium">
              Model ID
            </label>
            <input
              id="model_id"
              placeholder="gpt-4o-mini"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              onBlur={() => touched && runValidation()}
              autoComplete="off"
              aria-invalid={Boolean(errors.model_id)}
              aria-describedby={errors.model_id ? "model_id-error" : undefined}
              className={fieldClass(Boolean(errors.model_id))}
            />
            {errors.model_id && (
              <p id="model_id-error" role="alert" className="mt-1 text-sm text-red-600">
                {errors.model_id}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Model capabilities <span className="font-normal text-slate-500">(optional — shown in opencode as Context / Reasoning / Inputs)</span>
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="context_limit" className="mb-1 block text-sm font-medium">
                  Context window
                </label>
                <input
                  id="context_limit"
                  inputMode="numeric"
                  placeholder="e.g. 262144"
                  value={contextLimit}
                  onChange={(e) => setContextLimit(e.target.value)}
                  aria-invalid={Boolean(errors.context_limit)}
                  aria-describedby={errors.context_limit ? "context_limit-error" : undefined}
                  className={fieldClass(Boolean(errors.context_limit))}
                />
                {errors.context_limit && (
                  <p id="context_limit-error" role="alert" className="mt-1 text-sm text-red-600">
                    {errors.context_limit}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="output_limit" className="mb-1 block text-sm font-medium">
                  Max output tokens
                </label>
                <input
                  id="output_limit"
                  inputMode="numeric"
                  placeholder="e.g. 65536"
                  value={outputLimit}
                  onChange={(e) => setOutputLimit(e.target.value)}
                  aria-invalid={Boolean(errors.output_limit)}
                  aria-describedby={errors.output_limit ? "output_limit-error" : undefined}
                  className={fieldClass(Boolean(errors.output_limit))}
                />
                {errors.output_limit && (
                  <p id="output_limit-error" role="alert" className="mt-1 text-sm text-red-600">
                    {errors.output_limit}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {(
                [
                  { key: "tool_call", label: "Tool calling", hint: "Model can use opencode tools (recommended on)", checked: toolCall, set: setToolCall },
                  { key: "reasoning", label: "Reasoning", hint: "Model exposes thinking blocks", checked: reasoning, set: setReasoning },
                  { key: "attachment", label: "Attachments (images)", hint: "Writes modalities input text+image so opencode shows image Inputs", checked: attachment, set: setAttachment },
                ] as const
              ).map((o) => (
                <label key={o.key} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={o.checked}
                    onChange={(e) => o.set(e.target.checked)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span>
                    <span className="font-medium">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {errors._form && (
            <div
              role={status === "success" ? "status" : "alert"}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {errors._form}
            </div>
          )}

          {status === "success" && result && (
            <div role="status" className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
              <p className="font-medium">Saved. Opencode will use it automatically.</p>
              <p className="mt-1 break-all">Model: {result.model}</p>
              <p className="break-all">File: {result.path}</p>
              {result.backup && <p className="break-all">Backup: {result.backup}</p>}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={status === "saving"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Submit & Apply to Opencode"}
            </button>
            <button
              type="button"
              onClick={handleLoadCurrent}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Load current
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Writes global ~/.config/opencode/opencode.json and sets top-level model.
      </p>
    </main>
  );
}
