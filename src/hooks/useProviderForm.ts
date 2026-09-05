import { useCallback, useEffect, useState } from "react";
import {
  providerSchema,
  toFieldErrors,
  type FieldErrors,
  type ProviderSummary,
} from "@/lib/provider-schema";

export type ProviderType = "openai-compatible" | "custom";

export type SaveSuccess = { path: string; model: string; backup: string | null };

export type FormStatus = "idle" | "saving" | "success" | "error";

export function useProviderForm() {
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
  const [modelSel, setModelSel] = useState<string>("__new_model");
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [result, setResult] = useState<SaveSuccess | null>(null);
  const [touched, setTouched] = useState(false);
  const [testing, setTesting] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "busy">("idle");

  const selectedProvider = providers.find((p) => p.id === selected) ?? null;
  // Blank key is only acceptable when editing a provider that already has one.
  const requireKey = !selectedProvider?.hasKey;

  async function refreshProviders() {
    try {
      const res = await fetch("/api/current-config");
      const d = (await res.json()) as { ok: boolean; providers?: ProviderSummary[] };
      if (d.ok && Array.isArray(d.providers)) setProviders(d.providers);
    } catch {
      // Dropdown stays empty; form still works for new providers.
    }
  }

  useEffect(() => {
    void refreshProviders();
  }, []);

  const runValidation = useCallback((): FieldErrors => {
    const candidate = {
      base_url: baseUrl,
      api_key: apiKey.trim() ? apiKey : undefined,
      model_id: modelId,
      providerType,
      providerId,
      context_limit: contextLimit.trim() ? contextLimit.trim() : undefined,
      output_limit: outputLimit.trim() ? outputLimit.trim() : undefined,
      tool_call: toolCall,
      reasoning,
      attachment,
    };
    const next = toFieldErrors(providerSchema.safeParse(candidate));
    if (requireKey) {
      if (!apiKey.trim()) next.api_key = "api_key is required.";
    } else {
      delete next.api_key;
    }
    setErrors(next);
    return next;
  }, [
    baseUrl,
    apiKey,
    modelId,
    providerType,
    providerId,
    contextLimit,
    outputLimit,
    toolCall,
    reasoning,
    attachment,
    requireKey,
  ]);

  function loadModel(p: ProviderSummary, modelId: string | null) {
    setModelSel(modelId ?? "__new_model");
    setLoadedModelId(modelId);
    const m = p.models.find((x) => x.id === modelId) ?? null;
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

  function loadProvider(p: ProviderSummary) {
    setSelected(p.id);
    setProviderType(p.id === "custom" ? "openai-compatible" : "custom");
    setProviderId(p.id);
    setBaseUrl(p.baseURL ?? "");
    setApiKey("");
    setTestMsg(null);
    setTesting("idle");
    loadModel(p, p.models[0]?.id ?? null);
  }

  function reset() {
    setSelected("__new");
    setModelSel("__new_model");
    setLoadedModelId(null);
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
    setTesting("idle");
    setTestMsg(null);
    setDiscovered([]);
    setDeleting("idle");
    setErrors({});
    setResult(null);
    setStatus("idle");
    setTouched(false);
  }

  function handleSelectChange(id: string) {
    if (id === "__new") {
      reset();
      return;
    }
    const p = providers.find((x) => x.id === id);
    if (p) loadProvider(p);
  }

  function handleModelChange(id: string) {
    if (!selectedProvider) return;
    loadModel(selectedProvider, id === "__new_model" ? null : id);
  }

  async function testConnection() {
    setTesting("testing");
    setTestMsg(null);
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey.trim() }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        models?: string[];
        count?: number;
        error?: string;
      };
      if (data.ok) {
        setTesting("ok");
        setDiscovered(data.models ?? []);
        setTestMsg(
          `Reachable. ${data.count ?? 0} model${data.count === 1 ? "" : "s"} discovered — pick one from the Model ID suggestions.`
        );
      } else {
        setTesting("error");
        setTestMsg(data.error ?? "Connection failed.");
      }
    } catch {
      setTesting("error");
      setTestMsg("Network error. Is the app server running?");
    }
  }

  async function confirmDelete() {
    if (!selectedProvider || deleting === "busy") return;
    setDeleting("busy");
    try {
      const res = await fetch("/api/delete-provider", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: selectedProvider.id }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        newModel?: string | null;
        clearedActiveModel?: boolean;
        errors?: FieldErrors;
      };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? { _form: "Delete failed." });
        setStatus("error");
        setDeleting("idle");
        return;
      }
      await refreshProviders();
      reset();
      setErrors({
        _form: data.clearedActiveModel
          ? `Provider deleted. It was the active model; opencode now uses ${data.newModel ?? "(none)"}.`
          : "Provider deleted.",
      });
      setStatus("error");
      setDeleting("idle");
    } catch {
      setErrors({ _form: "Network error. Is the app server running?" });
      setStatus("error");
      setDeleting("idle");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setResult(null);
    if (Object.keys(runValidation()).length > 0) {
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
          base_url: baseUrl,
          api_key: apiKey.trim(),
          model_id: modelId,
          providerType,
          providerId: providerId.trim().toLowerCase() || "custom",
          ...(loadedModelId && loadedModelId !== modelId.trim()
            ? { editModelId: loadedModelId }
            : {}),
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

  async function loadCurrent() {
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

  return {
    // values
    baseUrl,
    apiKey,
    modelId,
    providerType,
    providerId,
    contextLimit,
    outputLimit,
    toolCall,
    reasoning,
    attachment,
    providers,
    selected,
    selectedProvider,
    modelSel,
    showKey,
    errors,
    status,
    result,
    touched,
    testing,
    testMsg,
    discovered,
    deleting,
    // setters
    setBaseUrl,
    setApiKey,
    setModelId,
    setProviderType,
    setProviderId,
    setContextLimit,
    setOutputLimit,
    setToolCall,
    setReasoning,
    setAttachment,
    setShowKey,
    // actions
    runValidation,
    handleSelectChange,
    handleModelChange,
    submit,
    loadCurrent,
    testConnection,
    confirmDelete,
    setDeleting,
    reset,
  };
}

export type ProviderForm = ReturnType<typeof useProviderForm>;
