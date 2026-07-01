import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ExcalidrawEditor } from "@/components/excalidraw/ExcalidrawEditor"
import { EMPTY_DIAGRAM } from "@/lib/excalidraw"

// Excalidraw canvas is dynamic + client-only; stub it out.
vi.mock("@/components/excalidraw/ExcalidrawCanvas", () => ({
  ExcalidrawCanvas: () => <div data-testid="canvas" />,
}))

// Capture the props ShareControl receives.
vi.mock("@/components/excalidraw/ShareControl", () => ({
  ShareControl: ({ diagramId, initialShareToken }: { diagramId: string; initialShareToken: string | null }) => (
    <div data-testid="share-control" data-diagram={diagramId} data-token={String(initialShareToken)} />
  ),
}))

describe("ExcalidrawEditor", () => {
  it("renders ShareControl with the diagramId and shareToken", () => {
    render(
      <ExcalidrawEditor initialData={EMPTY_DIAGRAM} diagramId="diag-1" shareToken="tok-9" />
    )
    const control = screen.getByTestId("share-control")
    expect(control).toHaveAttribute("data-diagram", "diag-1")
    expect(control).toHaveAttribute("data-token", "tok-9")
  })

  it("passes a null shareToken through for a private diagram", () => {
    render(
      <ExcalidrawEditor initialData={EMPTY_DIAGRAM} diagramId="diag-2" shareToken={null} />
    )
    expect(screen.getByTestId("share-control")).toHaveAttribute("data-token", "null")
  })
})
