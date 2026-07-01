"use client"

import dynamic from "next/dynamic"

// Excalidraw touches `window` at module eval, so the inner component (which
// statically imports it) lives in a separate file loaded ONLY via ssr:false.
// This file must NOT import Excalidraw directly — the public /share page is a
// server component that imports ShareCanvas, and a top-level Excalidraw import
// here would crash server rendering.
export const ShareCanvas = dynamic(
  () =>
    import("./ShareCanvasInner").then((mod) => ({
      default: mod.ShareCanvasInner,
    })),
  {
    ssr: false,
    loading: () => <div className="h-screen w-screen bg-white" />,
  }
)
