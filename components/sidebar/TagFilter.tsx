"use client"

import type { TagSummary } from "@/lib/tags"
import { TagChip } from "./TagChip"

type Props = { tags: TagSummary[]; activeTagId: string | null; onSelect: (id: string | null) => void }

export function TagFilter({ tags, activeTagId, onSelect }: Props) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-row gap-2 overflow-x-auto px-2 py-1">
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          aria-pressed={tag.id === activeTagId}
          onClick={() => onSelect(tag.id === activeTagId ? null : tag.id)}
        >
          <TagChip name={tag.name} active={tag.id === activeTagId} />
        </button>
      ))}
    </div>
  )
}
