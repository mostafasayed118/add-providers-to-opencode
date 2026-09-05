import type { ProviderSummary } from "@/lib/provider-schema";

export function ProviderSelect({
  providers,
  selected,
  onChange,
  multiModelNote,
}: {
  providers: ProviderSummary[];
  selected: string;
  onChange: (id: string) => void;
  multiModelNote: boolean;
}) {
  return (
    <div>
      <label htmlFor="existing_provider" className="mb-1 block text-sm font-medium">
        Provider
      </label>
      <select
        id="existing_provider"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
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
      {multiModelNote && (
        <p className="mt-1 text-xs text-slate-500">
          Editing the first model; other models on this provider are left untouched.
        </p>
      )}
    </div>
  );
}
