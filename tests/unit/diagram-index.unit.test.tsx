import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DiagramRow } from "@/components/diagrams/DiagramRow"
import { DiagramList } from "@/components/diagrams/DiagramList"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const ROW = {
  id: "diag-1",
  name: "My Diagram",
  updatedAt: new Date().toISOString(),
}

describe("DiagramRow", () => {
  const onRename = vi.fn()
  const onDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders name and formatted timestamp in idle mode", () => {
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    expect(screen.getByText("My Diagram")).toBeInTheDocument()
    expect(screen.getByText("Just now")).toBeInTheDocument()
  })

  it("navigates to diagram on row click", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /open my diagram/i }))
    expect(mockPush).toHaveBeenCalledWith("/diagrams/diag-1")
  })

  it("enters rename mode when rename button is clicked", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename my diagram/i }))
    expect(screen.getByRole("textbox", { name: /rename diagram/i })).toBeInTheDocument()
  })

  it("calls onRename with trimmed name on Enter", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename my diagram/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "New Name")
    await user.keyboard("{Enter}")
    expect(onRename).toHaveBeenCalledWith("diag-1", "New Name")
  })

  it("does not call onRename when name is unchanged", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename my diagram/i }))
    await user.keyboard("{Enter}")
    expect(onRename).not.toHaveBeenCalled()
  })

  it("does not call onRename when name is blank", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename my diagram/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.keyboard("{Enter}")
    expect(onRename).not.toHaveBeenCalled()
  })

  it("cancels rename on Escape and restores original name", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename my diagram/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Something else")
    await user.keyboard("{Escape}")
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText("My Diagram")).toBeInTheDocument()
  })

  it("cancels rename on blur and does not call onRename", async () => {
    const user = userEvent.setup()
    render(
      <div>
        <DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />
        <button>outside</button>
      </div>
    )
    await user.click(screen.getByRole("button", { name: /rename my diagram/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Won't save")
    await user.click(screen.getByRole("button", { name: "outside" }))
    expect(onRename).not.toHaveBeenCalled()
  })

  it("shows delete confirm inline when delete button is clicked", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete my diagram/i }))
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
  })

  it("calls onDelete when Delete is confirmed", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete my diagram/i }))
    await user.click(screen.getByRole("button", { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith("diag-1")
  })

  it("does not call onDelete when Cancel is clicked", async () => {
    const user = userEvent.setup()
    render(<DiagramRow {...ROW} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete my diagram/i }))
    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText("My Diagram")).toBeInTheDocument()
  })
})

const DIAGRAMS = [
  { id: "d1", name: "Alpha", updatedAt: new Date().toISOString() },
  { id: "d2", name: "Beta", updatedAt: new Date().toISOString() },
]

describe("DiagramList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders a row for each diagram", () => {
    render(<DiagramList diagrams={DIAGRAMS} />)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("renders empty state when diagrams is empty", () => {
    render(<DiagramList diagrams={[]} />)
    expect(screen.getByText(/no diagrams yet/i)).toBeInTheDocument()
  })

  it("renders New Diagram button in header", () => {
    render(<DiagramList diagrams={DIAGRAMS} />)
    expect(screen.getByRole("button", { name: /new diagram/i })).toBeInTheDocument()
  })

  it("optimistically updates name on rename before fetch resolves", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "d1", name: "Updated", updatedAt: new Date().toISOString() }), { status: 200 })
    )
    render(<DiagramList diagrams={DIAGRAMS} />)
    await user.click(screen.getAllByRole("button", { name: /rename alpha/i })[0])
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Updated")
    await user.keyboard("{Enter}")
    expect(screen.getByText("Updated")).toBeInTheDocument()
  })

  it("reverts name on rename fetch failure", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockRejectedValue(new Error("network"))
    render(<DiagramList diagrams={DIAGRAMS} />)
    await user.click(screen.getAllByRole("button", { name: /rename alpha/i })[0])
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Will Fail")
    await user.keyboard("{Enter}")
    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument()
    })
  })

  it("optimistically removes item on delete before fetch resolves", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DiagramList diagrams={DIAGRAMS} />)
    await user.click(screen.getAllByRole("button", { name: /delete alpha/i })[0])
    await user.click(screen.getByRole("button", { name: /^delete$/i }))
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
  })

  it("reverts deleted item on fetch failure", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockRejectedValue(new Error("network"))
    render(<DiagramList diagrams={DIAGRAMS} />)
    await user.click(screen.getAllByRole("button", { name: /delete alpha/i })[0])
    await user.click(screen.getByRole("button", { name: /^delete$/i }))
    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument()
    })
  })
})
