import type { ReactNode } from "react";

export function inputClass(hasError: boolean): string {
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
    hasError
      ? "border-red-500 focus:ring-red-200 dark:focus:ring-red-900"
      : "border-slate-300 focus:border-blue-500 focus:ring-blue-200 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-900"
  }`;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** Numbered eyebrow caption that structures the long form into steps. */
export function SectionLabel({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
      <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">{n}</span>
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 self-center bg-slate-200 dark:bg-slate-700" />
    </p>
  );
}

export const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400";

export const secondaryBtn =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800";

export function CheckRow({  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-blue-600"
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </label>
  );
}
