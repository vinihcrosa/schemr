import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ShareControl } from "@/components/excalidraw/ShareControl"

const writeText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  writable: true,
  value: { writeText },
})

describe("ShareControl", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    writeText.mockClear()
    writeText.mockResolvedValue(undefined)
  })

  it("private state: shows Share, no Public indicator", () => {
    render(<ShareControl diagramId="d1" initialShareToken={null} />)
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument()
    expect(screen.queryByText("Public")).not.toBeInTheDocument()
  })

  it("enable flow: POSTs to share endpoint and shows the URL", async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ shareToken: "tok123" }),
    })

    render(<ShareControl diagramId="d1" initialShareToken={null} />)
    await user.click(screen.getByRole("button", { name: "Share" }))
    await user.click(screen.getByRole("button", { name: "Enable public link" }))

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/diagrams/d1/share",
      expect.objectContaining({ method: "POST" }),
    )
    expect(screen.getByText(/\/share\/tok123/)).toBeInTheDocument()
  })

  it("shared state: shows Public indicator + URL, Copy writes to clipboard", async () => {
    const user = userEvent.setup()
    // userEvent.setup() installs its own clipboard stub; reinstate our spy.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: { writeText },
    })
    render(<ShareControl diagramId="d1" initialShareToken="tok123" />)
    await user.click(screen.getByRole("button", { name: "Share" }))

    expect(screen.getByText("Public")).toBeInTheDocument()
    const url = `${window.location.origin}/share/tok123`
    expect(screen.getByText(url)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Copy link" }))
    expect(writeText).toHaveBeenCalledWith(url)
  })

  it("revoke confirm gate: first click shows confirm, only confirm calls DELETE", async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    render(<ShareControl diagramId="d1" initialShareToken="tok123" />)
    await user.click(screen.getByRole("button", { name: "Share" }))

    await user.click(screen.getByRole("button", { name: "Stop sharing" }))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirm" }))
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/diagrams/d1/share",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
