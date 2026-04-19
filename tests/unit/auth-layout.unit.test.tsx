import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock next-auth auth()
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

// Mock next/navigation redirect
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AuthLayout from "@/app/(auth)/layout"

describe("AuthLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders children when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const jsx = await AuthLayout({ children: <div>child content</div> })
    render(jsx)
    expect(screen.getByText("child content")).toBeInTheDocument()
  })

  it("redirects to / when session exists", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", email: "a@b.com" }, expires: "" } as never)
    await AuthLayout({ children: <div /> })
    expect(redirect).toHaveBeenCalledWith("/")
  })
})
