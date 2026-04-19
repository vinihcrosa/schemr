import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SignUpPage from "@/app/(auth)/sign-up/page"

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders name, email, and password fields", () => {
    render(<SignUpPage />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
  })

  it("renders link to sign-in page", () => {
    render(<SignUpPage />)
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in")
  })

  it("displays 409 error when email already exists", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ status: 409 } as Response)
    const user = userEvent.setup()
    render(<SignUpPage />)

    await user.type(screen.getByLabelText("Email"), "test@example.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An account with this email already exists"
      )
    })
  })

  it("displays field errors on 400 response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 400,
      json: async () => ({ errors: { password: ["String must contain at least 8 character(s)"] } }),
    } as Response)
    const user = userEvent.setup()
    render(<SignUpPage />)

    await user.type(screen.getByLabelText("Email"), "test@example.com")
    await user.type(screen.getByLabelText("Password"), "short")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8/i)).toBeInTheDocument()
    })
  })

  it("calls signIn after successful registration", async () => {
    const { signIn } = await import("next-auth/react")
    vi.mocked(global.fetch).mockResolvedValue({ status: 201 } as Response)
    const user = userEvent.setup()
    render(<SignUpPage />)

    await user.type(screen.getByLabelText("Email"), "test@example.com")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "password123",
        callbackUrl: "/",
      })
    })
  })
})
