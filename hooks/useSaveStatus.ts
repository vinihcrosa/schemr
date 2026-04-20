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
  debounceMs = 800,
}: UseSaveStatusOptions): UseSaveStatusResult {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const statusRef = useRef<SaveStatus>("idle")
  const pendingStateRef = useRef<ExcalidrawState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const diagramIdRef = useRef(diagramId)

  useEffect(() => { diagramIdRef.current = diagramId }, [diagramId])

  const setStatusBoth = useCallback((s: SaveStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const save = useCallback(
    async (state: ExcalidrawState) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setStatusBoth("saving")
      try {
        const res = await fetch(`/api/diagrams/${diagramId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: state }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        pendingStateRef.current = null
        setStatusBoth("saved")
        setTimeout(() => setStatusBoth("idle"), 2000)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setStatusBoth("error")
      }
    },
    [diagramId, setStatusBoth]
  )

  const schedulesSave = useCallback(
    (state: ExcalidrawState) => {
      pendingStateRef.current = state
      setStatusBoth("pending")
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (pendingStateRef.current) save(pendingStateRef.current)
      }, debounceMs)
    },
    [save, debounceMs, setStatusBoth]
  )

  const retry = useCallback(() => {
    if (pendingStateRef.current) save(pendingStateRef.current)
  }, [save])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      // On SPA navigation (component unmount), flush any pending save immediately.
      // keepalive: true keeps the request alive even after the component is gone.
      if (statusRef.current === "pending" && pendingStateRef.current) {
        try {
          fetch(`/api/diagrams/${diagramIdRef.current}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: pendingStateRef.current }),
            keepalive: true,
          }).catch(() => {})
        } catch {
          // Ignore — relative URLs fail in non-browser environments (e.g. test runner)
        }
      }
      // Don't abort in-flight saves on unmount — let them complete.
    }
  }, [])

  return { status, schedulesSave, retry }
}
