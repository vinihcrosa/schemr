"use client"

type Props = { value: string; onChange: (v: string) => void; onClear: () => void }

export function SearchInput({ value, onChange, onClear }: Props) {
  return (
    <div className="relative px-2 py-1.5">
      <input
        type="text"
        aria-label="Search diagrams"
        placeholder="Search diagrams..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-700 text-zinc-100 text-xs rounded px-2 py-1 pr-6 outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-500"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
