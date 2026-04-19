import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import DiagramIndexPage from "@/app/(app)/page"

describe("DiagramIndexPage", () => {
  it("renders the placeholder text", () => {
    render(<DiagramIndexPage />)
    expect(screen.getByText("Diagram Index — coming soon")).toBeInTheDocument()
  })
})
