import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TagManager } from "@/components/sidebar/TagManager"
import type { TagSummary } from "@/lib/tags"

const sampleTags: TagSummary[] = [
  { id: "tag-1", name: "typescript" },
  { id: "tag-2", name: "react" },
]

function makeProps(overrides?: {
  tags?: TagSummary[]
  onCreate?: () => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onClose?: () => void
}) {
  return {
    tags: overrides?.tags ?? sampleTags,
    onCreate: overrides?.onCreate ?? vi.fn().mockResolvedValue(undefined),
    onDelete: overrides?.onDelete ?? vi.fn().mockResolvedValue(undefined),
    onClose: overrides?.onClose ?? vi.fn(),
  }
}

describe("TagManager", () => {
  it("renders heading", () => {
    render(<TagManager {...makeProps()} />)
    expect(screen.getByText("Manage Tags")).toBeInTheDocument()
  })

  it("shows error when submitting empty input", async () => {
    const user = userEvent.setup()
    render(<TagManager {...makeProps()} />)
    await user.click(screen.getByRole("button", { name: /create/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("Tag name required")
  })

  it("shows error when input exceeds 32 characters", async () => {
    const user = userEvent.setup()
    render(<TagManager {...makeProps()} />)
    await user.type(screen.getByRole("textbox", { name: /new tag name/i }), "a".repeat(33))
    await user.click(screen.getByRole("button", { name: /create/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("Max 32 characters")
  })

  it("calls onCreate with trimmed name on valid submit", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<TagManager {...makeProps({ onCreate })} />)
    await user.type(screen.getByRole("textbox", { name: /new tag name/i }), "  newtag  ")
    await user.click(screen.getByRole("button", { name: /create/i }))
    expect(onCreate).toHaveBeenCalledWith("newtag")
  })

  it("calls onCreate when Enter key is pressed on input", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<TagManager {...makeProps({ onCreate })} />)
    await user.type(screen.getByRole("textbox", { name: /new tag name/i }), "mytag{Enter}")
    expect(onCreate).toHaveBeenCalledWith("mytag")
  })

  it("shows Confirm and Cancel buttons when delete is clicked", async () => {
    const user = userEvent.setup()
    render(<TagManager {...makeProps()} />)
    await user.click(screen.getByRole("button", { name: /delete typescript/i }))
    expect(screen.getByRole("button", { name: /confirm delete typescript/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel delete typescript/i })).toBeInTheDocument()
  })

  it("hides Confirm and Cancel buttons when Cancel is clicked", async () => {
    const user = userEvent.setup()
    render(<TagManager {...makeProps()} />)
    await user.click(screen.getByRole("button", { name: /delete typescript/i }))
    await user.click(screen.getByRole("button", { name: /cancel delete typescript/i }))
    expect(screen.queryByRole("button", { name: /confirm delete typescript/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /delete typescript/i })).toBeInTheDocument()
  })

  it("calls onDelete with tag id when Confirm is clicked", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<TagManager {...makeProps({ onDelete })} />)
    await user.click(screen.getByRole("button", { name: /delete typescript/i }))
    await user.click(screen.getByRole("button", { name: /confirm delete typescript/i }))
    expect(onDelete).toHaveBeenCalledWith("tag-1")
  })

  it("calls onClose when Close button is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TagManager {...makeProps({ onClose })} />)
    await user.click(screen.getByRole("button", { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
