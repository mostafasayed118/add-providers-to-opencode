import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  providerSchema,
  toFieldErrors,
  type FieldErrors,
  type ProviderSummary,
} from "@/lib/provider-schema";
import type { Strings } from "@/i18n";
import { PRESETS, type Preset } from "@/lib/presets";

export type ConfigTarget =
  | { kind: "global" }
  | { kind: "project"; dir: string }
  | { kind: "custom"; path: string };

export type ProviderType = "openai-compatible" | "custom";

export type SaveSuccess = {
  path: string;
  model: string;
  backup: string | null;
  notice: string | null;
};

export type FormStatus = "idle" | "saving" | "success" | "error" | "info";

export type HeaderRow = { name: string; value: string };

export type BackupRow = {
  file: string;
  kind: "backup" | "corrupt";
  bytes: number;
  mtimeMs: number;
};

export type DiffLine = { type: "same" | "add" | "del"; text: string };

export type PreviewData = {
  model: string;
  changed: boolean;
  sections: Array<{ title: string; lines: DiffLine[] }>;
};

export type DoctorIssue = {
  id: string;
  level: "error" | "warn";
  provider?: string;
  message: string;
  fixable: boolean;
};

export type HistoryEntry = {
  ts: string;
  action: string;
  provider?: string | null;
  model?: string | null;
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
  const [gates, setGates] = useState<{ enabled: string[]; disabled: string[] }>({
    enabled: [],
    disabled: [],
  });
  const [externalChanged, setExternalChanged] = useState(false);
  const [bulkSel, setBulkSel] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [target, setTargetState] = useState<ConfigTarget>({ kind: "global" });
  const [targetPath, setTargetPath] = useState("");
  const [verifyState, setVerifyState] = useState<"idle" | "busy">("idle");
  const [verifyRows, setVerifyRows] = useState<
    Array<{ id: string; ok: boolean; count?: number; error?: string }>
  >([]);
  const [autofilling, setAutofilling] = useState(false);
  const [copiedTick, setCopiedTick] = useState(false);
  // Last seen config mtime. Our own writes re-baseline silently; anything
  // else raising mtime means an outside edit (hand edit, opencode itself).
  const mtimeRef = useRef<number | null>(null);
  const targetRef = useRef<ConfigTarget>(target);
  targetRef.current = target;
  const targetSwitchingRef = useRef(false);

  function setTarget(t: ConfigTarget) {
    setTargetState(t);
    targetRef.current = t;
    mtimeRef.current = null;
    setExternalChanged(false);
    reset();
    targetSwitchingRef.current = true;
    void refreshAll({ quietMtime: true }).finally(() => {
      targetSwitchingRef.current = false;
    });
  }

  /** Query suffix carrying the active config target for GET routes. */
  function targetQuery(): string {
    return `?t=${encodeURIComponent(JSON.stringify(targetRef.current))}`;
  }

  async function refreshProviders(
    opts?: { quietMtime?: boolean }
  ): Promise<ProviderSummary[] | undefined> {
    try {
      const res = await fetch(`/api/current-config${targetQuery()}`);
      const d = (await res.json()) as {
        ok: boolean;
        providers?: ProviderSummary[];
        model?: string | null;
        smallModel?: string | null;
        mtimeMs?: number | null;
        gates?: { enabled: string[]; disabled: string[] };
      };
      if (d.ok) {
        if (Array.isArray(d.providers)) setProviders(d.providers);
        setActiveModel(d.model ?? null);
        setStoredSmallModel(d.smallModel ?? null);
        if (d.gates) setGates(d.gates);
        if (typeof d.mtimeMs === "number") {
          if (
            !opts?.quietMtime &&
            mtimeRef.current !== null &&
            d.mtimeMs !== mtimeRef.current
          ) {
            setExternalChanged(true);
          }
          mtimeRef.current = d.mtimeMs;
        }
        return Array.isArray(d.providers) ? d.providers : undefined;
      }
    } catch {
      // Dropdown stays empty; form still works for new providers.
    }
    return undefined;
  }
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [promptState, setPromptState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [promptMsg, setPromptMsg] = useState<string | null>(null);
  const [issues, setIssues] = useState<DoctorIssue[]>([]);
  const [doctorState, setDoctorState] = useState<"idle" | "checking" | "fixing">("idle");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cloning, setCloning] = useState(false);

  const selectedProvider = providers.find((p) => p.id === selected) ?? null;
  // Blank key is only acceptable when editing a provider that already has one.
  const requireKey = !selectedProvider?.hasKey;
  const showOnboarding =
    !onboardDismissed && !touched && !result && providers.length > 0 && selected === "__new";

  async function refreshBackups() {
    try {
      const res = await fetch(`/api/backups${targetQuery()}`);
      const d = (await res.json()) as { ok: boolean; backups?: BackupRow[] };
      if (d.ok && Array.isArray(d.backups)) setBackups(d.backups);
    } catch {
      // Backup list is best-effort.
    }
  }

  async function refreshDoctor() {
    try {
      const res = await fetch(`/api/doctor${targetQuery()}`);
      const d = (await res.json()) as { ok: boolean; issues?: DoctorIssue[] };
      if (d.ok && Array.isArray(d.issues)) setIssues(d.issues);
    } catch {
      // Doctor panel is best-effort.
    }
  }

  async function refreshHistory() {
    try {
      const res = await fetch(`/api/history${targetQuery()}`);
      const d = (await res.json()) as { ok: boolean; entries?: HistoryEntry[] };
      if (d.ok && Array.isArray(d.entries)) setHistory(d.entries);
    } catch {
      // History panel is best-effort.
    }
  }

  async function refreshAll(
    opts?: { quietMtime?: boolean }
  ): Promise<ProviderSummary[] | undefined> {
    const [freshProviders] = await Promise.all([
      refreshProviders(opts),
      refreshBackups(),
      refreshDoctor(),
      refreshHistory(),
    ]);
    return freshProviders;
  }

  async function dismissExternal() {
    setExternalChanged(false);
    await refreshAll({ quietMtime: true });
  }

  function hideExternal() {
    setExternalChanged(false);
  }

  useEffect(() => {
    void refreshAll();
    // Batch the ~15 loadDraft setX calls + follow-up into one render.
    startTransition(() => {
      if (loadDraft()) {
        setErrors({ _form: t.draftLoaded });
        setStatus("info");
      }
    });
  }, []);

  // Watch for outside edits (hand edit, opencode itself writing the file).
  // Paused when tab hidden; skipped while a target switch refresh is in flight.
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      if (targetSwitchingRef.current) return;
      void refreshProviders();
    };
    const timer = setInterval(tick, 5000);
    const onVis = () => {
      if (!document.hidden && !targetSwitchingRef.current) void refreshProviders();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function gateOfSelected(): "auto" | "enabled" | "disabled" {
    if (!selectedProvider) return "auto";
    if (gates.disabled.includes(selectedProvider.id)) return "disabled";
    if (gates.enabled.includes(selectedProvider.id)) return "enabled";
    return "auto";
  }

  async function setGate(state: "auto" | "enabled" | "disabled") {
    if (!selectedProvider) return;
    try {
      const res = await fetch("/api/gates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetRef.current, providerId: selectedProvider.id, state }),
      });
      const data = (await res.json()) as { ok: boolean; errors?: FieldErrors };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? { _form: t.gateFailed });
        setStatus("error");
        return;
      }
      await refreshAll({ quietMtime: true });
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    }
  }

  function toggleBulk(id: string) {
    setBulkSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function deleteBulk() {
    if (bulkSel.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/delete-many", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetRef.current, ids: bulkSel }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        deleted?: number;
        newModel?: string | null;
        clearedActiveModel?: boolean;
        errors?: FieldErrors;
      };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? { _form: t.deleteFailed });
        setStatus("error");
        return;
      }
      setBulkSel([]);
      await refreshAll({ quietMtime: true });
      reset();
      setErrors({
        _form: t.bulkDeleted(data.deleted ?? bulkSel.length, data.newModel ?? t.none),
      });
      setStatus("info");
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportPack() {
    try {
      const res = await fetch(`/api/export${targetQuery()}`);
      const data = (await res.json()) as { ok: boolean; pack?: unknown };
      if (!res.ok || !data.ok) throw new Error("export failed");
      const blob = new Blob([JSON.stringify(data.pack, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opencode-providers.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrors({ _form: t.exportFailed });
      setStatus("error");
    }
  }

  async function importPackFile(file: File) {
    setImportBusy(true);
    try {
      const text = await file.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        setErrors({ _form: t.importBadJson });
        setStatus("error");
        return;
      }
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: body, target: targetRef.current }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        imported?: string[];
        errors?: FieldErrors;
      };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? { _form: t.importFailed });
        setStatus("error");
        return;
      }
      await refreshAll({ quietMtime: true });
      reset();
      setErrors({ _form: t.imported((data.imported ?? []).join(", ")) });
      setStatus("info");
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setImportBusy(false);
    }
  }

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
    clearDraft();    setSelected("__new");
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
    setPreview(null);
    setPreviewing(false);
    setPromptState("idle");
    setPromptMsg(null);
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

  function buildPayload(): Record<string, unknown> {
    return {
      target: targetRef.current,
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
    };
  }

  /** Submit shows a diff preview first; the write happens on confirm. */
  async function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    setTouched(true);
    setOnboardDismissed(true);
    setResult(null);
    setPreview(null);
    if (Object.keys(runValidation()).length > 0) {
      setStatus("error");
      return;
    }
    setPreviewing(true);
    setErrors({});
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await res.json()) as
        | (PreviewData & { ok: true })
        | { ok: false; errors: FieldErrors };
      if (!res.ok || !data.ok) {
        setErrors((data as { errors?: FieldErrors }).errors ?? { _form: t.saveFailed });
        setStatus("error");
        return;
      }
      setPreview({ model: data.model, changed: data.changed, sections: data.sections });
      setStatus("idle");
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setPreviewing(false);
    }
  }

  async function confirmSubmit(): Promise<string | null> {
    setPreview(null);
    setStatus("saving");
    setErrors({});
    try {
      const res = await fetch("/api/save-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await res.json()) as
        | (SaveSuccess & { ok: true })
        | { ok: false; errors: FieldErrors };
      if (!res.ok || !data.ok) {
        setErrors((data as { errors?: FieldErrors }).errors ?? { _form: t.saveFailed });
        setStatus("error");
        return null;
      }
      setResult({
        path: data.path,
        model: data.model,
        backup: data.backup,
        notice: (data as { notice?: string | null }).notice ?? null,
      });
      setStatus("success");
      clearDraft();
      await refreshAll({ quietMtime: true });
      return data.model;
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
      return null;
    }
  }

  /**
   * Simple-mode "save & add another": keep provider, credentials and
   * capabilities; clear just the model so the next ID starts fresh.
   * NOTE: result + "success" status are intentionally kept so the saved
   * card (file/backup/copy-ref button) stays visible; the _form line
   * below it prompts for the next model.
   */
  function resetModelForNext(savedModel: string) {
    setModelSel("__new_model");
    setLoadedModelId(null);
    setModelId("");
    setDiscovered([]);
    setTesting("idle");
    setTestMsg(null);
    setPromptState("idle");
    setPromptMsg(null);
    setErrors({ _form: t.savedAddAnother(savedModel) });
    setTouched(false);
  }

  function applyPreset(p: Preset) {
    setBaseUrl(p.baseURL);
    setProviderId(p.providerId);
    setProviderType("custom");
    if (p.context) setContextLimit(String(p.context));
    setErrors({});
    setResult(null);
    setPreview(null);
    setStatus("idle");
  }

  async function testPrompt() {
    setPromptState("testing");
    setPromptMsg(null);
    try {
      const res = await fetch("/api/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: baseUrl,
          api_key: apiKey.trim(),
          model_id: modelId.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; reply?: string; error?: string };
      if (data.ok) {
        setPromptState("ok");
        setPromptMsg(t.promptOk(data.reply ?? ""));
      } else {
        setPromptState("error");
        setPromptMsg(data.error ?? t.testFailed);
      }
    } catch {
      setPromptState("error");
      setPromptMsg(t.networkError);
    }
  }

  async function loadDoctor() {
    setDoctorState("checking");
    await refreshDoctor();
    setDoctorState("idle");
  }

  async function fixIssue(id: string) {
    setDoctorState("fixing");
    try {
      const res = await fetch("/api/doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, target: targetRef.current }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        fixed?: string;
        errors?: FieldErrors;
      };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? { _form: t.fixFailed });
        setStatus("error");
      } else {
        setErrors({ _form: t.fixed(data.fixed ?? "") });
        setStatus("info");
        await refreshAll({ quietMtime: true });
      }
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setDoctorState("idle");
    }
  }

  async function cloneSelected() {
    if (!selectedProvider || cloning) return;
    setCloning(true);
    try {
      const res = await fetch("/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: selectedProvider.id, target: targetRef.current }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        newId?: string;
        errors?: FieldErrors;
      };
      if (!res.ok || !data.ok || !data.newId) {
        setErrors(data.errors ?? { _form: t.cloneFailed });
        setStatus("error");
        return;
      }
      // Reuse refreshAll result instead of a second GET to /api/current-config.
      const freshProviders = await refreshAll({ quietMtime: true });
      const p = freshProviders?.find((x) => x.id === data.newId);
      if (p) loadProvider(p);
      else {
        setErrors({ _form: t.cloned(data.newId) });
        setStatus("info");
      }
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setCloning(false);
    }
  }

  async function undoLast() {
    if (backups.length === 0) return;
    await restore(backups[0].file);
  }

  async function verifyAll() {
    setVerifyState("busy");
    setVerifyRows([]);
    try {
      const res = await fetch("/api/verify-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetRef.current }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        rows?: Array<{ id: string; ok: boolean; count?: number; error?: string }>;
        errors?: FieldErrors;
      };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? { _form: t.verifyFailed });
        setStatus("error");
      } else {
        setVerifyRows(data.rows ?? []);
      }
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setVerifyState("idle");
    }
  }

  async function autofillCapabilities() {
    if (!modelId.trim() || autofilling) return;
    setAutofilling(true);
    try {
      const res = await fetch("/api/model-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId.trim() }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        match?: { id: string; context?: number; output?: number; imageInput?: boolean };
        error?: string;
      };
      if (!res.ok || !data.ok || !data.match) {
        setErrors({ _form: data.error ?? t.autofillFailed });
        setStatus("error");
        return;
      }
      if (data.match.context) setContextLimit(String(data.match.context));
      if (data.match.output) setOutputLimit(String(data.match.output));
      if (data.match.imageInput) setAttachment(true);
      setErrors({ _form: t.autofilled(data.match.id) });
      setStatus("info");
    } catch {
      setErrors({ _form: t.networkError });
      setStatus("error");
    } finally {
      setAutofilling(false);
    }
  }

  async function copyModelRef(ref: string) {
    try {
      await navigator.clipboard.writeText(ref);
      setCopiedTick(true);
      setTimeout(() => setCopiedTick(false), 1500);
    } catch {
      setErrors({ _form: t.copyFailed });
      setStatus("error");
    }
  }

  const DRAFT_KEY = "provider-form-draft-v1";

  // Persist unsent form input (never the secret) so a refresh loses nothing.
  // Skipped while the form is pristine-empty so we never store empty drafts.
  const hasDraftableContent =
    baseUrl.trim() !== "" ||
    modelId.trim() !== "" ||
    providerId.trim() !== "" ||
    contextLimit.trim() !== "" ||
    outputLimit.trim() !== "" ||
    smallModel.trim() !== "" ||
    headerRows.some((r) => r.name.trim() !== "");
  useEffect(() => {
    if (!hasDraftableContent) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            baseUrl,
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
            headerRows: headerRows.filter((r) => r.name.trim() !== ""),
            smallModel,
          })
        );
      } catch {
        // Storage full or blocked; the form still works.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    hasDraftableContent,
    baseUrl,
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
  ]);

  function loadDraft(): boolean {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      if (str(d.baseUrl)) setBaseUrl(str(d.baseUrl));
      if (str(d.modelId)) setModelId(str(d.modelId));
      if (d.providerType === "openai-compatible" || d.providerType === "custom") {
        setProviderType(d.providerType);
      }
      if (str(d.providerId)) setProviderId(str(d.providerId));
      setContextLimit(str(d.contextLimit));
      setOutputLimit(str(d.outputLimit));
      if (typeof d.toolCall === "boolean") setToolCall(d.toolCall);
      if (typeof d.reasoning === "boolean") setReasoning(d.reasoning);
      if (typeof d.attachment === "boolean") setAttachment(d.attachment);
      if (str(d.reasoningField)) setReasoningField(str(d.reasoningField));
      if (d.keyStorage === "env" || d.keyStorage === "file" || d.keyStorage === "inline") {
        setKeyStorage(d.keyStorage);
      }
      setKeyEnvName(str(d.keyEnvName));
      setKeyFile(str(d.keyFile));
      if (Array.isArray(d.headerRows)) {
        setHeaderRows(
          d.headerRows
            .filter(
              (r): r is { name: string; value: string } =>
                !!r && typeof (r as { name?: unknown }).name === "string"
            )
            .map((r) => ({ name: r.name, value: typeof r.value === "string" ? r.value : "" }))
            .slice(0, 20)
        );
      }
      setSmallModel(str(d.smallModel));
      setTouched(true);
      return true;
    } catch {
      return false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore.
    }
  }

  async function loadCurrent() {
    setErrors({});
    try {
      const res = await fetch(`/api/current-config${targetQuery()}`);
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
      setStatus("info");
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
        body: JSON.stringify({ providerId: selectedProvider.id, target: targetRef.current }),
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
      await refreshAll({ quietMtime: true });
      reset();
      setErrors({
        _form: data.clearedActiveModel
          ? t.deletedActive(data.newModel ?? t.none)
          : t.deleted,
      });
      setStatus("info");
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
        body: JSON.stringify({ file, target: targetRef.current }),
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
        await refreshAll({ quietMtime: true });
        reset();
        setErrors({ _form: t.restored(data.model ?? t.none) });
        setStatus("info");
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
    gates,
    externalChanged,
    bulkSel,
    bulkBusy,
    importBusy,
    target,
    targetPath,
    verifyState,
    verifyRows,
    autofilling,
    copiedTick,
    preview,
    previewing,
    promptState,
    promptMsg,
    issues,
    doctorState,
    history,
    cloning,
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
    setPreview,
    setOnboardDismissed,
    runValidation,
    handleSelectChange,
    handleModelChange,
    loadActiveModel,
    applyPreset,
    submit,
    confirmSubmit,
    resetModelForNext,
    closePreview: () => setPreview(null),
    loadCurrent,
    testConnection,
    testPrompt,
    loadDoctor,
    fixIssue,
    cloneSelected,
    undoLast,
    confirmDelete,
    restore,
    setGate,
    gateOfSelected,
    toggleBulk,
    clearBulk: () => setBulkSel([]),
    deleteBulk,
    exportPack,
    importPackFile,
    dismissExternal,
    hideExternal,
    setTarget,
    setTargetPath,
    verifyAll,
    autofillCapabilities,
    copyModelRef,
    loadDraft,
    clearDraft,
    reset,
  };
}

export type ProviderForm = ReturnType<typeof useProviderForm>;
