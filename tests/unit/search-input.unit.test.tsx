import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SearchInput } from "@/components/sidebar/SearchInput"

describe("SearchInput", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders with placeholder text", () => {
    render(<SearchInput value="" onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByPlaceholderText("Search diagrams...")).toBeInTheDocument()
  })

  it("renders with aria-label", () => {
    render(<SearchInput value="" onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole("textbox", { name: "Search diagrams" })).toBeInTheDocument()
  })

  it("clear button is hidden when value is empty", () => {
    render(<SearchInput value="" onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
  })

  it("clear button is visible when value is non-empty", () => {
    render(<SearchInput value="abc" onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument()
  })

  it("typing calls onChange with new value", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} onClear={vi.fn()} />)
    const input = screen.getByRole("textbox", { name: "Search diagrams" })
    await user.type(input, "hello")
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toBe("h")
  })

  it("clicking clear button calls onClear", async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<SearchInput value="abc" onChange={vi.fn()} onClear={onClear} />)
    await user.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
