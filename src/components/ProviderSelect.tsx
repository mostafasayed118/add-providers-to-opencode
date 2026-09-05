import type { ProviderSummary } from "@/lib/provider-schema";
import type { Strings } from "@/i18n";
import { selectClass } from "./form-fields";

export function ProviderSelect({
  t,
  providers,
  selected,
  onChange,
}: {
  t: Strings;
  providers: ProviderSummary[];
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label htmlFor="existing_provider" className="mb-1 block text-sm font-medium">
        {t.provider}
      </label>
      <select
        id="existing_provider"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="__new">{t.newProvider}</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id}
            {p.models[0] ? ` — ${p.models[0].id}` : ""}
            {p.models.length > 1 ? ` (+${p.models.length - 1} more)` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
