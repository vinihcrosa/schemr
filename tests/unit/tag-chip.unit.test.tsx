import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TagChip } from "@/components/sidebar/TagChip"

describe("TagChip", () => {
  it("renders the tag name", () => {
    render(<TagChip name="typescript" />)
    expect(screen.getByText("typescript")).toBeInTheDocument()
  })

  it("does not render a remove button when onRemove is not provided", () => {
    render(<TagChip name="typescript" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders a × button when onRemove is provided", () => {
    render(<TagChip name="typescript" onRemove={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Remove typescript tag" })).toBeInTheDocument()
  })

  it("calls onRemove when the × button is clicked", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<TagChip name="typescript" onRemove={onRemove} />)
    await user.click(screen.getByRole("button", { name: "Remove typescript tag" }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("applies active classes when active=true", () => {
    render(<TagChip name="typescript" active={true} />)
    const chip = screen.getByText("typescript").closest("span")
    expect(chip).toHaveClass("border-indigo-500")
    expect(chip).toHaveClass("bg-indigo-100")
    expect(chip).toHaveClass("text-indigo-700")
  })

  it("applies inactive classes when active is not set", () => {
    render(<TagChip name="typescript" />)
    const chip = screen.getByText("typescript").closest("span")
    expect(chip).toHaveClass("border-slate-200")
    expect(chip).toHaveClass("bg-slate-50")
    expect(chip).toHaveClass("text-slate-600")
  })
})
