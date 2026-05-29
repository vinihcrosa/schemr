import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DiagramSidebar } from "@/components/sidebar/DiagramSidebar"
import type { SidebarData } from "@/lib/sidebar-tree"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, "localStorage", { value: localStorageMock })

const SIDEBAR_DATA: SidebarData = {
  folders: [],
  rootDiagrams: [
    { id: "d1", name: "Alpha", updatedAt: "2024-01-01T00:00:00.000Z", folderId: null },
    { id: "d2", name: "Beta", updatedAt: "2024-01-02T00:00:00.000Z", folderId: null },
  ],
}

const INITIAL_TAGS = [
  { id: "t1", name: "frontend" },
  { id: "t2", name: "backend" },
]

describe("DiagramSidebar — tag management", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  it("renders Tags button in sidebar header", () => {
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    expect(screen.getByRole("button", { name: /manage tags/i })).toBeInTheDocument()
  })

  it("clicking Tags button opens TagManager", async () => {
    const user = userEvent.setup()
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    await user.click(screen.getByRole("button", { name: /manage tags/i }))
    expect(screen.getByText("Manage Tags")).toBeInTheDocument()
  })

  it("TagManager is not rendered before the button is clicked", () => {
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    expect(screen.queryByText("Manage Tags")).not.toBeInTheDocument()
  })

  it("onClose hides TagManager", async () => {
    const user = userEvent.setup()
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    await user.click(screen.getByRole("button", { name: /manage tags/i }))
    expect(screen.getByText("Manage Tags")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /close/i }))
    expect(screen.queryByText("Manage Tags")).not.toBeInTheDocument()
  })

  it("handleCreateTag: calls POST /api/tags with name", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "t3", name: "devops" }), { status: 200 })
    )
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    await user.click(screen.getByRole("button", { name: /manage tags/i }))
    const input = screen.getByRole("textbox", { name: /new tag name/i })
    await user.type(input, "devops")
    await user.click(screen.getByRole("button", { name: /create/i }))
    await waitFor(() =>
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        "/api/tags",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "devops" }),
        })
      )
    )
  })

  it("handleCreateTag: adds new tag to list on success", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "t3", name: "devops" }), { status: 200 })
    )
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    await user.click(screen.getByRole("button", { name: /manage tags/i }))
    const input = screen.getByRole("textbox", { name: /new tag name/i })
    await user.type(input, "devops")
    await user.click(screen.getByRole("button", { name: /create/i }))
    // Tag should appear in TagManager list (as a delete button target)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /delete devops/i })).toBeInTheDocument()
    )
  })

  it("handleDeleteTag: calls DELETE /api/tags/:tagId", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }))
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    await user.click(screen.getByRole("button", { name: /manage tags/i }))
    // Click delete on first tag (frontend)
    await user.click(screen.getByRole("button", { name: /delete frontend/i }))
    // Confirm deletion
    await user.click(screen.getByRole("button", { name: /confirm delete frontend/i }))
    await waitFor(() =>
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        "/api/tags/t1",
        expect.objectContaining({ method: "DELETE" })
      )
    )
  })

  it("handleDeleteTag: optimistically removes tag from TagManager list", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }))
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    await user.click(screen.getByRole("button", { name: /manage tags/i }))
    // Verify delete button present before deletion
    expect(screen.getByRole("button", { name: /delete frontend/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /delete frontend/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete frontend/i }))
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /delete frontend/i })).not.toBeInTheDocument()
    )
  })

  it("handleDeleteTag: rolls back on fetch failure", async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockRejectedValue(new Error("network"))
    render(
      <DiagramSidebar
        initialData={SIDEBAR_DATA}
        currentId="d1"
        userName="Alice"
        initialTags={INITIAL_TAGS}
      />
    )
    await user.click(screen.getByRole("button", { name: /manage tags/i }))
    await user.click(screen.getByRole("button", { name: /delete frontend/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete frontend/i }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /delete frontend/i })).toBeInTheDocument()
    )
  })
})
