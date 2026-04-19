import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import SignInPage from "@/app/(auth)/sign-in/page"

// Mock the server action
vi.mock("@/app/(auth)/sign-in/actions", () => ({
  login: vi.fn(),
}))

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe("SignInPage", () => {
  it("renders email and password fields", () => {
    render(<SignInPage />)
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
  })

  it("renders link to sign-up page", () => {
    render(<SignInPage />)
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up")
  })
})
