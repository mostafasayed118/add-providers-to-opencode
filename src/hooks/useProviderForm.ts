import { useCallback, useEffect, useState } from "react";
import {
  providerSchema,
  toFieldErrors,
  type FieldErrors,
  type ProviderSummary,
} from "@/lib/provider-schema";
import type { Strings } from "@/i18n";

export type ProviderType = "openai-compatible" | "custom";

export type SaveSuccess = {
  path: string;
  model: string;
  backup: string | null;
  notice: string | null;
};

export type FormStatus = "idle" | "saving" | "success" | "error";

export type HeaderRow = { name: string; value: string };

export type BackupRow = {
  file: string;
  kind: "backup" | "corrupt";
  bytes: number;
  mtimeMs: number;
};

export function useProviderForm(t: Strings) {
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
  const [reasoningField, setReasoningField] = useState<string>("");
  const [keyStorage, setKeyStorage] = useState<"inline" | "env" | "file">("inline");
  const [keyEnvName, setKeyEnvName] = useState("");
  const [keyFile, setKeyFile] = useState("");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [smallModel, setSmallModel] = useState("");
  const [storedSmallModel, setStoredSmallModel] = useState<string | null>(null);
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
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [onboardDismissed, setOnboardDismissed] = useState(false);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);

  const selectedProvider = providers.find((p) => p.id === selected) ?? null;
  // Blank key is only acceptable when editing a provider that already has one.
  const requireKey = !selectedProvider?.hasKey;
  const showOnboarding =
    !onboardDismissed && !touched && !result && providers.length > 0 && selected === "__new";

  async function refreshProviders() {
    try {
      const res = await fetch("/api/current-config");
      const d = (await res.json()) as {
        ok: boolean;
        providers?: ProviderSummary[];
        model?: string | null;
        smallModel?: string | null;
      };
      if (d.ok) {
        if (Array.isArray(d.providers)) setProviders(d.providers);
        setActiveModel(d.model ?? null);
        setStoredSmallModel(d.smallModel ?? null);
      }
    } catch {
      // Dropdown stays empty; form still works for new providers.
    }
  }

  async function refreshBackups() {
    try {
      const res = await fetch("/api/backups");
      const d = (await res.json()) as { ok: boolean; backups?: BackupRow[] };
      if (d.ok && Array.isArray(d.backups)) setBackups(d.backups);
    } catch {
      // Backup list is best-effort.
    }
  }

  useEffect(() => {
    void refreshProviders();
    void refreshBackups();
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
      reasoning_field: reasoningField ? reasoningField : undefined,
      keyStorage,
      keyEnvName: keyEnvName.trim() ? keyEnvName.trim() : undefined,
      keyFile: keyFile.trim() ? keyFile.trim() : undefined,
      headers: headerRows
        .filter((r) => r.name.trim() !== "")
        .map((r) => ({ name: r.name.trim(), value: r.value })),
      small_model: smallModel.trim() ? smallModel.trim() : undefined,
    };
    const next = toFieldErrors(providerSchema.safeParse(candidate));
    if (requireKey) {
      if (!apiKey.trim()) next.api_key = t.apiKeyRequired;
    } else {
      delete next.api_key;
    }
    if (keyStorage !== "inline" && apiKey.trim()) {
      if (keyStorage === "env" && !keyEnvName.trim()) {
        next._form = t.keyEnvNameRequired;
      }
      if (keyStorage === "file" && !keyFile.trim()) {
        next._form = t.keyFileRequired;
      }
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
    reasoningField,
    keyStorage,
    keyEnvName,
    keyFile,
    headerRows,
    smallModel,
    requireKey,
    t,
  ]);

  function loadModel(p: ProviderSummary, modelId: string | null) {
    setModelSel(modelId ?? "__new_model");
    setLoadedModelId(modelId);
    const m = p.models.find((x) => x.id === modelId) ?? null;
    setModelId(m?.id ?? "");
    setToolCall(m?.tool_call ?? true);
    setReasoning(m?.reasoning ?? false);
    setAttachment(m?.attachment ?? false);
    setReasoningField(
      m?.interleaved === "reasoning" ||
        m?.interleaved === "reasoning_content" ||
        m?.interleaved === "reasoning_text"
        ? m.interleaved
        : ""
    );
    setContextLimit(m?.limit?.context != null ? String(m.limit.context) : "");
    setOutputLimit(m?.limit?.output != null ? String(m.limit.output) : "");
    if (p.keyRef?.kind === "env") {
      setKeyStorage("env");
      setKeyEnvName(p.keyRef.name);
      setKeyFile("");
    } else if (p.keyRef?.kind === "file") {
      setKeyStorage("file");
      setKeyFile(p.keyRef.name);
      setKeyEnvName("");
    } else {
      setKeyStorage("inline");
      setKeyEnvName("");
    }
    setHeaderRows(p.headerNames.map((name) => ({ name, value: "" })));
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
    setOnboardDismissed(true);
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
    setReasoningField("");
    setKeyStorage("inline");
    setKeyEnvName("");
    setKeyFile("");
    setHeaderRows([]);
    setSmallModel("");
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

  function loadActiveModel() {
    if (!activeModel) return;
    const slash = activeModel.indexOf("/");
    if (slash < 0) return;
    const pid = activeModel.slice(0, slash);
    const mid = activeModel.slice(slash + 1);
    const p = providers.find((x) => x.id === pid);
    if (!p) return;
    setSelected(p.id);
    setProviderType(p.id === "custom" ? "openai-compatible" : "custom");
    setProviderId(p.id);
    setBaseUrl(p.baseURL ?? "");
    setApiKey("");
    setOnboardDismissed(true);
    loadModel(p, p.models.some((m) => m.id === mid) ? mid : (p.models[0]?.id ?? null));
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
        setTestMsg(t.testOk((data.models ?? []).length));
      } else {
        setTesting("error");
        setTestMsg(data.error ?? t.testFailed);
      }
    } catch {
      setTesting("error");
      setTestMsg(t.networkError);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setOnboardDismissed(true);
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
          ...(reasoningField ? { reasoning_field: reasoningField } : {}),
          keyStorage,
          ...(keyEnvName.trim() ? { keyEnvName: keyEnvName.trim() } : {}),
          ...(keyFile.trim() ? { keyFile: keyFile.trim() } : {}),
          headers: headerRows
            .filter((r) => r.name.trim() !== "")
            .map((r) => ({ name: r.name.trim(), value: r.value })),
          ...(smallModel.trim() ? { small_model: smallModel.trim() } : {}),
        }),
      });
      const data = (await res.json()) as
        | (SaveSuccess & { ok: true })
        | { ok: false; errors: FieldErrors };
      if (!res.ok || !data.ok) {
        setErrors((data as { errors?: FieldErrors }).errors ?? { _form: t.saveFailed });
        setStatus("error");
        return;
      }
      setResult({
        path: data.path,
        model: data.model,
        backup: data.backup,
        notice: (data as { notice?: string | null }).notice ?? null,
      });
      setStatus("success");
      await refreshProviders();
      await refreshBackups();
    } catch {
      setErrors({ _form: t.networkError });
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
          ? { _form: t.currentModel(data.model ?? t.none, data.path) }
          : { _form: t.noConfig(data.path) }
      );
      setStatus("error");
    } catch {
      setErrors({ _form: t.loadFailed });
      setStatus("error");
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
        setErrors(data.errors ?? { _form: t.deleteFailed });
        setStatus("error");
        setDeleting("idle");
        return;
      }
      await refreshProviders();
      await refreshBackups();
      reset();
      setErrors({
        _form: data.clearedActiveModel
          ? t.deletedActive(data.newModel ?? t.none)
          : t.deleted,
      });
      setStatus("error");
      setDeleting("idle");
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
      setDeleting("idle");
    }
  }

  async function restore(file: string) {
    setRestoring(file);
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        model?: string | null;
        errors?: FieldErrors;
      };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? { _form: t.restoreFailed });
        setStatus("error");
      } else {
        await refreshProviders();
        await refreshBackups();
        reset();
        setErrors({ _form: t.restored(data.model ?? t.none) });
        setStatus("error");
      }
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setRestoring(null);
    }
  }

  return {
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
    reasoningField,
    keyStorage,
    keyEnvName,
    keyFile,
    headerRows,
    smallModel,
    storedSmallModel,
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
    activeModel,
    showOnboarding,
    onboardDismissed,
    backups,
    restoring,
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
    setReasoningField,
    setKeyStorage,
    setKeyEnvName,
    setKeyFile,
    setHeaderRows,
    setSmallModel,
    setShowKey,
    setDeleting,
    setOnboardDismissed,
    runValidation,
    handleSelectChange,
    handleModelChange,
    loadActiveModel,
    submit,
    loadCurrent,
    testConnection,
    confirmDelete,
    restore,
    reset,
  };
}

export type ProviderForm = ReturnType<typeof useProviderForm>;
