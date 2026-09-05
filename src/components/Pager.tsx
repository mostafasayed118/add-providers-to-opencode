export const PAGE_SIZE = 5;

export function Pager({
  label,
  page,
  totalPages,
  prevLabel,
  nextLabel,
  pageLabel,
  onPrev,
  onNext,
}: {
  label: string;
  page: number;
  totalPages: number;
  prevLabel: string;
  nextLabel: string;
  pageLabel: (page: number, total: number) => string;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-3 flex items-center justify-between gap-2">
      <button
        type="button"
        disabled={page === 0}
        onClick={onPrev}
        className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {prevLabel}
      </button>
      <span role="status" className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
        {pageLabel(page + 1, totalPages)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages - 1}
        onClick={() => onNext()}
        className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium transition duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {nextLabel}
      </button>
    </nav>
  );
}
