"use client"

import type { SaveStatus } from "@/hooks/useSaveStatus"

type Props = {
  status: SaveStatus
  onRetry: () => void
}

export function SaveIndicator({ status, onRetry }: Props) {
  if (status === "idle" || status === "pending") return null

  if (status === "saving") {
    return (
      <div className="absolute top-3 right-3 z-50 text-sm text-gray-400 pointer-events-none">
        Saving…
      </div>
    )
  }

  if (status === "saved") {
    return (
      <div className="absolute top-3 right-3 z-50 text-sm text-gray-400 pointer-events-none">
        Saved ✓
      </div>
    )
  }

  return (
    <div className="absolute top-3 right-3 z-50 text-sm text-red-500 flex items-center gap-1">
      Save failed ·{" "}
      <button onClick={onRetry} className="underline cursor-pointer">
        Retry
      </button>
    </div>
  )
}
