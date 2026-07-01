"use client"

import { Excalidraw } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import type { ExcalidrawState } from "@/lib/excalidraw"
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types"

type Props = {
  data: ExcalidrawState
  name: string
}

export function ShareCanvasInner({ data, name }: Props) {
  return (
    <div className="relative w-full h-full">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
        <span
          data-testid="share-name"
          className="truncate text-sm font-medium text-slate-700"
        >
          {name}
        </span>
      </div>
      <Excalidraw
        viewModeEnabled
        initialData={data as unknown as ExcalidrawInitialDataState}
      />
    </div>
  )
}
