"use client"

import { useRef, useCallback, useEffect } from "react"
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import {
  serializeCanvas,
  type ExcalidrawState,
  type ExcalidrawElement,
} from "@/lib/excalidraw"
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types"
import { useSaveStatus } from "@/hooks/useSaveStatus"
import { SaveIndicator } from "./SaveIndicator"

type Props = {
  initialData: ExcalidrawState
  diagramId: string
}

async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function ExcalidrawCanvas({ initialData, diagramId }: Props) {
  const localStateRef = useRef<ExcalidrawState>(initialData)
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)

  const getThumbnail = useCallback(async (): Promise<string | null> => {
    const api = excalidrawApiRef.current
    if (!api) return null
    const elements = api.getSceneElements()
    if (elements.length === 0) return null
    try {
      const blob = await exportToBlob({
        elements,
        appState: api.getAppState(),
        files: api.getFiles(),
        mimeType: "image/jpeg",
        quality: 0.6,
      })
      return blobToDataURL(blob)
    } catch {
      return null
    }
  }, [])

  const { status, schedulesSave, retry } = useSaveStatus({ diagramId, getThumbnail })

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

  // Fallback for tab close / hard refresh — sendBeacon survives page unload.
  // SPA navigation is handled inside useSaveStatus via keepalive fetch on unmount.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (typeof navigator === "undefined") return
      navigator.sendBeacon(
        `/api/diagrams/${diagramId}`,
        new Blob([JSON.stringify({ data: localStateRef.current })], {
          type: "application/json",
        })
      )
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [diagramId])

  return (
    <div className="relative w-full h-full">
      <Excalidraw
        initialData={initialData as unknown as ExcalidrawInitialDataState}
        excalidrawAPI={(api) => { excalidrawApiRef.current = api }}
        onChange={
          handleChange as Parameters<typeof Excalidraw>[0]["onChange"]
        }
      />
      <SaveIndicator status={status} onRetry={retry} />
    </div>
  )
}
