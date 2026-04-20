import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SidebarItem } from "@/components/sidebar/SidebarItem"
import { DiagramSidebar } from "@/components/sidebar/DiagramSidebar"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, "localStorage", { value: localStorageMock })

// ─── SidebarItem ─────────────────────────────────────────────────────────────

const ITEM = { id: "d1", name: "Alpha", isCurrent: false }

describe("SidebarItem", () => {
  const onRename = vi.fn()
  const onDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders name in idle mode", () => {
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("current item does not navigate on click", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} isCurrent onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByText("Alpha"))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("non-current item navigates on click", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByText("Alpha"))
    expect(mockPush).toHaveBeenCalledWith("/diagrams/d1")
  })

  it("edit icon click enters rename mode with pre-filled input", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename alpha/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue("Alpha")
  })

  it("Enter with new name calls onRename", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename alpha/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Beta")
    await user.keyboard("{Enter}")
    expect(onRename).toHaveBeenCalledWith("d1", "Beta")
  })

  it("Enter with same name does not call onRename", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename alpha/i }))
    await user.keyboard("{Enter}")
    expect(onRename).not.toHaveBeenCalled()
  })

  it("Enter with blank name does not call onRename", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename alpha/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.keyboard("{Enter}")
    expect(onRename).not.toHaveBeenCalled()
  })

  it("Escape in rename cancels and restores original name", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /rename alpha/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Cancelled")
    await user.keyboard("{Escape}")
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("blur in rename cancels without calling onRename", async () => {
    const user = userEvent.setup()
    render(
      <div>
        <SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />
        <button>outside</button>
      </div>
    )
    await user.click(screen.getByRole("button", { name: /rename alpha/i }))
    await user.type(screen.getByRole("textbox", { name: /rename diagram/i }), "X")
    await user.click(screen.getByRole("button", { name: "outside" }))
    expect(onRename).not.toHaveBeenCalled()
  })

  it("first delete click enters pending state", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete alpha/i }))
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel delete/i })).toBeInTheDocument()
  })

  it("second delete click calls onDelete", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete alpha/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete/i }))
    expect(onDelete).toHaveBeenCalledWith("d1")
  })

  it("cancel during delete-pending does not call onDelete", async () => {
    const user = userEvent.setup()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete alpha/i }))
    await user.click(screen.getByRole("button", { name: /cancel delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("delete-pending auto-cancels after 3s", () => {
    vi.useFakeTimers()
    render(<SidebarItem {...ITEM} onRename={onRename} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole("button", { name: /delete alpha/i }))
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3100) })
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /confirm delete/i })).not.toBeInTheDocument()
  })
})

// ─── DiagramSidebar ───────────────────────────────────────────────────────────

const DIAGRAMS = [
  { id: "d1", name: "Alpha", updatedAt: "2024-01-02T00:00:00.000Z" },
  { id: "d2", name: "Beta", updatedAt: "2024-01-01T00:00:00.000Z" },
]

describe("DiagramSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    global.fetch = vi.fn()
  })

  it("renders a SidebarItem for each diagram", () => {
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("current item has isCurrent=true (does not navigate on click)", async () => {
    const user = userEvent.setup()
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByText("Alpha"))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("non-current item navigates on click", async () => {
    const user = userEvent.setup()
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByText("Beta"))
    expect(mockPush).toHaveBeenCalledWith("/diagrams/d2")
  })

  it("toggle button collapses sidebar (list no longer rendered)", async () => {
    const user = userEvent.setup()
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }))
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    expect(screen.queryByText("Beta")).not.toBeInTheDocument()
  })

  it("toggle button expands sidebar again after collapse", async () => {
    const user = userEvent.setup()
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }))
    await user.click(screen.getByRole("button", { name: /expand sidebar/i }))
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("new diagram button is present and enabled by default", () => {
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    const btn = screen.getByRole("button", { name: /new diagram/i })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
  })

  it("create: optimistically prepends new item and navigates", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ id: "d3", name: "Untitled", updatedAt: new Date().toISOString() }),
        { status: 200 }
      )
    )
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /new diagram/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/diagrams/d3"))
  })

  it("rename: optimistically updates name in list", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "d2", name: "Renamed" }), { status: 200 })
    )
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /rename beta/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Renamed")
    await user.keyboard("{Enter}")
    expect(screen.getByText("Renamed")).toBeInTheDocument()
    expect(screen.queryByText("Beta")).not.toBeInTheDocument()
  })

  it("rename: reverts name on fetch failure", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockRejectedValue(new Error("network"))
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /rename beta/i }))
    const input = screen.getByRole("textbox", { name: /rename diagram/i })
    await user.clear(input)
    await user.type(input, "Will fail")
    await user.keyboard("{Enter}")
    await waitFor(() => expect(screen.getByText("Beta")).toBeInTheDocument())
  })

  it("delete: optimistically removes item", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /delete beta/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete/i }))
    await waitFor(() => expect(screen.queryByText("Beta")).not.toBeInTheDocument())
  })

  it("delete: re-inserts item on fetch failure", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockRejectedValue(new Error("network"))
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /delete beta/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete/i }))
    await waitFor(() => expect(screen.getByText("Beta")).toBeInTheDocument())
  })

  it("delete current diagram: calls router.push to next", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DiagramSidebar diagrams={DIAGRAMS} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /delete alpha/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/diagrams/d2"))
  })

  it("delete last diagram: navigates to /", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }))
    render(<DiagramSidebar diagrams={[DIAGRAMS[0]]} currentId="d1" userName="Alice" />)
    await user.click(screen.getByRole("button", { name: /delete alpha/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"))
  })
})
