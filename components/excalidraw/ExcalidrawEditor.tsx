"use client"

import dynamic from "next/dynamic"
import type { ExcalidrawState } from "@/lib/excalidraw"
import { ShareControl } from "./ShareControl"

const ExcalidrawCanvas = dynamic(
  () =>
    import("./ExcalidrawCanvas").then((mod) => ({
      default: mod.ExcalidrawCanvas,
    })),
  {
    ssr: false,
    loading: () => <div className="h-screen w-screen bg-white" />,
  }
)

type Props = {
  initialData: ExcalidrawState
  diagramId: string
  shareToken: string | null
}

export function ExcalidrawEditor({ initialData, diagramId, shareToken }: Props) {
  return (
    <div className="relative h-full w-full">
      <ExcalidrawCanvas initialData={initialData} diagramId={diagramId} />
      <ShareControl diagramId={diagramId} initialShareToken={shareToken} />
    </div>
  )
}
