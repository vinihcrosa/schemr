"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { ExcalidrawState } from "@/lib/excalidraw"

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error"

type UseSaveStatusOptions = {
  diagramId: string
  debounceMs?: number
}

type UseSaveStatusResult = {
  status: SaveStatus
  schedulesSave: (state: ExcalidrawState) => void
  retry: () => void
}

export function useSaveStatus({
  diagramId,
  debounceMs = 1500,
}: UseSaveStatusOptions): UseSaveStatusResult {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const pendingStateRef = useRef<ExcalidrawState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const save = useCallback(
    async (state: ExcalidrawState) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setStatus("saving")
      try {
        const res = await fetch(`/api/diagrams/${diagramId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: state }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setStatus("saved")
        setTimeout(() => setStatus("idle"), 2000)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setStatus("error")
      }
    },
    [diagramId]
  )

  const schedulesSave = useCallback(
    (state: ExcalidrawState) => {
      pendingStateRef.current = state
      setStatus("pending")
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (pendingStateRef.current) save(pendingStateRef.current)
      }, debounceMs)
    },
    [save, debounceMs]
  )

  const retry = useCallback(() => {
    if (pendingStateRef.current) save(pendingStateRef.current)
  }, [save])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return { status, schedulesSave, retry }
}
