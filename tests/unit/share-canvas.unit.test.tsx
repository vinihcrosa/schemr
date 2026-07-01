import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShareCanvasInner } from "@/components/excalidraw/ShareCanvasInner"
import { EMPTY_DIAGRAM } from "@/lib/excalidraw"

vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: (props: { viewModeEnabled?: boolean }) => (
    <div
      data-testid="excalidraw"
      data-viewmode={String(props.viewModeEnabled)}
    />
  ),
}))

vi.mock("@excalidraw/excalidraw/index.css", () => ({}))

describe("ShareCanvasInner", () => {
  it("renders the diagram name", () => {
    render(<ShareCanvasInner data={EMPTY_DIAGRAM} name="My Diagram" />)
    expect(screen.getByText("My Diagram")).toBeInTheDocument()
  })

  it("mounts Excalidraw in view mode", () => {
    render(<ShareCanvasInner data={EMPTY_DIAGRAM} name="My Diagram" />)
    const canvas = screen.getByTestId("excalidraw")
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute("data-viewmode", "true")
  })
})
