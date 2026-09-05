import { CheckRow, Field, inputClass } from "./form-fields";
import type { FieldErrors } from "@/lib/provider-schema";
import type { Strings } from "@/i18n";

export type CapabilityValues = {
  contextLimit: string;
  outputLimit: string;
  toolCall: boolean;
  reasoning: boolean;
  attachment: boolean;
  reasoningField: string;
};

const REASONING_FIELDS = ["reasoning", "reasoning_content", "reasoning_text"];

export function CapabilityFieldset({
  t,
  values,
  errors,
  onChange,
}: {
  t: Strings;
  values: CapabilityValues;
  errors: FieldErrors;
  onChange: (patch: Partial<CapabilityValues>) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {t.capabilities} <span className="font-normal text-slate-500">{t.capabilitiesNote}</span>
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t.contextWindow} htmlFor="context_limit" error={errors.context_limit}>
          <input
            id="context_limit"
            inputMode="numeric"
            placeholder="e.g. 262144"
            value={values.contextLimit}
            onChange={(e) => onChange({ contextLimit: e.target.value })}
            aria-invalid={Boolean(errors.context_limit)}
            aria-describedby={errors.context_limit ? "context_limit-error" : undefined}
            className={inputClass(Boolean(errors.context_limit))}
          />
        </Field>
        <Field label={t.maxOutput} htmlFor="output_limit" error={errors.output_limit}>
          <input
            id="output_limit"
            inputMode="numeric"
            placeholder="e.g. 65536"
            value={values.outputLimit}
            onChange={(e) => onChange({ outputLimit: e.target.value })}
            aria-invalid={Boolean(errors.output_limit)}
            aria-describedby={errors.output_limit ? "output_limit-error" : undefined}
            className={inputClass(Boolean(errors.output_limit))}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field
          label={t.reasoningField}
          htmlFor="reasoning_field"
          hint={t.reasoningFieldHint}
        >
          <select
            id="reasoning_field"
            value={values.reasoningField}
            onChange={(e) => onChange({ reasoningField: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">{t.reasoningFieldNone}</option>
            {REASONING_FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        <CheckRow
          label={t.toolCalling}
          hint={t.toolCallingHint}
          checked={values.toolCall}
          onChange={(v) => onChange({ toolCall: v })}
        />
        <CheckRow
          label={t.reasoning}
          hint={t.reasoningHint}
          checked={values.reasoning}
          onChange={(v) => onChange({ reasoning: v })}
        />
        <CheckRow
          label={t.attachments}
          hint={t.attachmentsHint}
          checked={values.attachment}
          onChange={(v) => onChange({ attachment: v })}
        />
      </div>
    </fieldset>
  );
}
