"use client"

type Props = { name: string; onRemove?: () => void; active?: boolean }

export function TagChip({ name, onRemove, active }: Props) {
  const baseClasses =
    "rounded-full border px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1"
  const colorClasses = active
    ? "border-indigo-500 bg-indigo-100 text-indigo-700"
    : "border-slate-200 bg-slate-50 text-slate-600"

  return (
    <span className={`${baseClasses} ${colorClasses}`}>
      {name}
      {onRemove !== undefined && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name} tag`}
          className="leading-none hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  )
}
