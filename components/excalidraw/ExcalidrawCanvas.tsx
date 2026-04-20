"use client"

import { useRef, useCallback, useEffect } from "react"
import { Excalidraw } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import {
  serializeCanvas,
  type ExcalidrawState,
  type ExcalidrawElement,
} from "@/lib/excalidraw"
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types"
import { useSaveStatus } from "@/hooks/useSaveStatus"
import { SaveIndicator } from "./SaveIndicator"

type Props = {
  initialData: ExcalidrawState
  diagramId: string
}

export function ExcalidrawCanvas({ initialData, diagramId }: Props) {
  const localStateRef = useRef<ExcalidrawState>(initialData)
  const { status, schedulesSave, retry } = useSaveStatus({ diagramId })

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      const state = serializeCanvas(elements, appState, files)
      localStateRef.current = state
      schedulesSave(state)
    },
    [schedulesSave]
  )

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (status === "pending" && typeof navigator !== "undefined") {
        navigator.sendBeacon(
          `/api/diagrams/${diagramId}`,
          new Blob([JSON.stringify({ data: localStateRef.current })], {
            type: "application/json",
          })
        )
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [status, diagramId])

  return (
    <div className="relative w-full h-full">
      <Excalidraw
        initialData={initialData}
        onChange={
          handleChange as Parameters<typeof Excalidraw>[0]["onChange"]
        }
      />
      <SaveIndicator status={status} onRetry={retry} />
    </div>
  )
}
