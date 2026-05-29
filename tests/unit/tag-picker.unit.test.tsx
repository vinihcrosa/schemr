import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TagPicker } from "@/components/sidebar/TagPicker"
import type { TagSummary } from "@/lib/tags"

const mockTags: TagSummary[] = [
  { id: "tag-1", name: "typescript" },
  { id: "tag-2", name: "react" },
  { id: "tag-3", name: "nextjs" },
]

const noop = async () => {}

describe("TagPicker", () => {
  it("shows 'No tags yet' message when availableTags is empty", () => {
    render(
      <TagPicker
        availableTags={[]}
        assignedTagIds={[]}
        onAssign={noop}
        onRemove={noop}
        onClose={noop}
      />
    )
    expect(screen.getByText("No tags yet. Create one in Manage Tags.")).toBeInTheDocument()
  })

  it("renders all available tags", () => {
    render(
      <TagPicker
        availableTags={mockTags}
        assignedTagIds={[]}
        onAssign={noop}
        onRemove={noop}
        onClose={noop}
      />
    )
    expect(screen.getByText("typescript")).toBeInTheDocument()
    expect(screen.getByText("react")).toBeInTheDocument()
    expect(screen.getByText("nextjs")).toBeInTheDocument()
  })

  it("calls onAssign when clicking an unassigned tag", async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn().mockResolvedValue(undefined)
    render(
      <TagPicker
        availableTags={mockTags}
        assignedTagIds={["tag-2"]}
        onAssign={onAssign}
        onRemove={noop}
        onClose={noop}
      />
    )
    await user.click(screen.getByRole("option", { name: /typescript/ }))
    expect(onAssign).toHaveBeenCalledWith("tag-1")
  })

  it("calls onRemove when clicking an assigned tag", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(
      <TagPicker
        availableTags={mockTags}
        assignedTagIds={["tag-2"]}
        onAssign={noop}
        onRemove={onRemove}
        onClose={noop}
      />
    )
    await user.click(screen.getByRole("option", { name: /react/ }))
    expect(onRemove).toHaveBeenCalledWith("tag-2")
  })

  it("marks assigned tags with aria-selected=true and unassigned with aria-selected=false", () => {
    render(
      <TagPicker
        availableTags={mockTags}
        assignedTagIds={["tag-1", "tag-3"]}
        onAssign={noop}
        onRemove={noop}
        onClose={noop}
      />
    )
    const typescriptBtn = screen.getByRole("option", { name: /typescript/ })
    const reactBtn = screen.getByRole("option", { name: /react/ })
    const nextjsBtn = screen.getByRole("option", { name: /nextjs/ })

    expect(typescriptBtn).toHaveAttribute("aria-selected", "true")
    expect(reactBtn).toHaveAttribute("aria-selected", "false")
    expect(nextjsBtn).toHaveAttribute("aria-selected", "true")
  })

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn()
    render(
      <TagPicker
        availableTags={mockTags}
        assignedTagIds={[]}
        onAssign={noop}
        onRemove={noop}
        onClose={onClose}
      />
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
