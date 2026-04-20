"use client"

import dynamic from "next/dynamic"
import type { ExcalidrawState } from "@/lib/excalidraw"

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
}

export function ExcalidrawEditor({ initialData, diagramId }: Props) {
  return <ExcalidrawCanvas initialData={initialData} diagramId={diagramId} />
}
