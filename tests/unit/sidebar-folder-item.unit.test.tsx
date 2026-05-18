import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DndContext } from "@dnd-kit/core"
import { SidebarFolderItem } from "@/components/sidebar/SidebarFolderItem"
import type { FolderNode } from "@/lib/sidebar-tree"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const makeFolder = (overrides?: Partial<FolderNode>): FolderNode => ({
  id: "f1",
  name: "My Folder",
  parentFolderId: null,
  children: [],
  diagrams: [],
  ...overrides,
})

const defaultProps = {
  folder: makeFolder(),
  depth: 0,
  isExpanded: false,
  onToggle: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  currentDiagramId: "d99",
}

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>)
}

describe("SidebarFolderItem", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it("renders folder name", () => {
    renderWithDnd(<SidebarFolderItem {...defaultProps} />)
    expect(screen.getByText("My Folder")).toBeInTheDocument()
  })

  it("applies indent based on depth", () => {
    renderWithDnd(<SidebarFolderItem {...defaultProps} depth={2} />)
    const row = screen.getByTestId("folder-row")
    expect(row).toHaveStyle({ paddingLeft: "24px" })
  })

  it("clicking folder row calls onToggle with id", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderWithDnd(<SidebarFolderItem {...defaultProps} onToggle={onToggle} />)
    await user.click(screen.getByTestId("folder-row"))
    expect(onToggle).toHaveBeenCalledWith("f1")
  })

  it("hides children when collapsed", () => {
    const folder = makeFolder({
      diagrams: [{ id: "d1", name: "ChildDiagram", updatedAt: "", folderId: "f1" }],
    })
    renderWithDnd(<SidebarFolderItem {...defaultProps} folder={folder} isExpanded={false} />)
    expect(screen.queryByText("ChildDiagram")).not.toBeInTheDocument()
  })

  it("shows diagram children when expanded", () => {
    const folder = makeFolder({
      diagrams: [{ id: "d1", name: "ChildDiagram", updatedAt: "", folderId: "f1" }],
    })
    renderWithDnd(<SidebarFolderItem {...defaultProps} folder={folder} isExpanded={true} />)
    expect(screen.getByText("ChildDiagram")).toBeInTheDocument()
  })

  it("shows nested folder child when expanded", () => {
    const childFolder = makeFolder({ id: "f2", name: "Child Folder" })
    const folder = makeFolder({ children: [childFolder] })
    renderWithDnd(
      <SidebarFolderItem {...defaultProps} folder={folder} isExpanded={true} />
    )
    expect(screen.getByText("Child Folder")).toBeInTheDocument()
  })

  it("rename button is present", () => {
    renderWithDnd(<SidebarFolderItem {...defaultProps} />)
    expect(screen.getByRole("button", { name: /rename my folder/i })).toBeInTheDocument()
  })

  it("clicking rename enters rename mode with pre-filled input", async () => {
    const user = userEvent.setup()
    renderWithDnd(<SidebarFolderItem {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /rename my folder/i }))
    const input = screen.getByRole("textbox", { name: /rename folder/i })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue("My Folder")
  })

  it("Enter with new name calls onRename", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    renderWithDnd(<SidebarFolderItem {...defaultProps} onRename={onRename} />)
    await user.click(screen.getByRole("button", { name: /rename my folder/i }))
    const input = screen.getByRole("textbox", { name: /rename folder/i })
    await user.clear(input)
    await user.type(input, "New Name")
    await user.keyboard("{Enter}")
    expect(onRename).toHaveBeenCalledWith("f1", "New Name")
  })

  it("Escape in rename cancels without calling onRename", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    renderWithDnd(<SidebarFolderItem {...defaultProps} onRename={onRename} />)
    await user.click(screen.getByRole("button", { name: /rename my folder/i }))
    await user.keyboard("{Escape}")
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText("My Folder")).toBeInTheDocument()
  })

  it("first delete click enters pending state", async () => {
    const user = userEvent.setup()
    renderWithDnd(<SidebarFolderItem {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /delete my folder/i }))
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel delete/i })).toBeInTheDocument()
  })

  it("second delete click calls onDelete", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderWithDnd(<SidebarFolderItem {...defaultProps} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete my folder/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete/i }))
    expect(onDelete).toHaveBeenCalledWith("f1")
  })

  it("cancel during delete-pending does not call onDelete", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderWithDnd(<SidebarFolderItem {...defaultProps} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: /delete my folder/i }))
    await user.click(screen.getByRole("button", { name: /cancel delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText("My Folder")).toBeInTheDocument()
  })

  it("delete-pending auto-cancels after 3s", () => {
    vi.useFakeTimers()
    renderWithDnd(<SidebarFolderItem {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: /delete my folder/i }))
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3100) })
    expect(screen.getByText("My Folder")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /confirm delete/i })).not.toBeInTheDocument()
  })
})
