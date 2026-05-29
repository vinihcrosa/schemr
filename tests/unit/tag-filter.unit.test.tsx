import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TagFilter } from "@/components/sidebar/TagFilter"
import type { TagSummary } from "@/lib/tags"

const tags: TagSummary[] = [
  { id: "tag-1", name: "typescript" },
  { id: "tag-2", name: "react" },
  { id: "tag-3", name: "nextjs" },
]

describe("TagFilter", () => {
  it("renders one pill per tag", () => {
    render(<TagFilter tags={tags} activeTagId={null} onSelect={vi.fn()} />)
    expect(screen.getByText("typescript")).toBeInTheDocument()
    expect(screen.getByText("react")).toBeInTheDocument()
    expect(screen.getByText("nextjs")).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it("returns null for empty tags", () => {
    const { container } = render(<TagFilter tags={[]} activeTagId={null} onSelect={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it("clicking an inactive tag calls onSelect with its id", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TagFilter tags={tags} activeTagId={null} onSelect={onSelect} />)
    await user.click(screen.getByText("react").closest("button")!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith("tag-2")
  })

  it("clicking the active tag calls onSelect with null", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TagFilter tags={tags} activeTagId="tag-1" onSelect={onSelect} />)
    await user.click(screen.getByText("typescript").closest("button")!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it("active chip has aria-pressed true", () => {
    render(<TagFilter tags={tags} activeTagId="tag-2" onSelect={vi.fn()} />)
    const reactButton = screen.getByText("react").closest("button")!
    expect(reactButton).toHaveAttribute("aria-pressed", "true")
  })

  it("inactive chips have aria-pressed false", () => {
    render(<TagFilter tags={tags} activeTagId="tag-2" onSelect={vi.fn()} />)
    const tsButton = screen.getByText("typescript").closest("button")!
    expect(tsButton).toHaveAttribute("aria-pressed", "false")
  })
})
