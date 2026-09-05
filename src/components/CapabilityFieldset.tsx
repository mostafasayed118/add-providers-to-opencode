import { CheckRow, Field, inputClass } from "./form-fields";
import type { FieldErrors } from "@/lib/provider-schema";

export type CapabilityValues = {
  contextLimit: string;
  outputLimit: string;
  toolCall: boolean;
  reasoning: boolean;
  attachment: boolean;
};

export function CapabilityFieldset({
  values,
  errors,
  onChange,
}: {
  values: CapabilityValues;
  errors: FieldErrors;
  onChange: (patch: Partial<CapabilityValues>) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        Model capabilities{" "}
        <span className="font-normal text-slate-500">
          (optional — shown in opencode as Context / Reasoning / Inputs)
        </span>
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Context window"
          htmlFor="context_limit"
          error={errors.context_limit}
        >
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
        <Field label="Max output tokens" htmlFor="output_limit" error={errors.output_limit}>
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
      <div className="mt-3 space-y-2">
        <CheckRow
          label="Tool calling"
          hint="Model can use opencode tools (recommended on)"
          checked={values.toolCall}
          onChange={(v) => onChange({ toolCall: v })}
        />
        <CheckRow
          label="Reasoning"
          hint="Model exposes thinking blocks"
          checked={values.reasoning}
          onChange={(v) => onChange({ reasoning: v })}
        />
        <CheckRow
          label="Attachments (images)"
          hint="Writes modalities input text+image so opencode shows image Inputs"
          checked={values.attachment}
          onChange={(v) => onChange({ attachment: v })}
        />
      </div>
    </fieldset>
  );
}
