import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiKeyManager } from "@/components/settings/ApiKeyManager"
import type { ApiKeySummary } from "@/lib/api-key"

const writeText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  writable: true,
  value: { writeText },
})

function summary(overrides: Partial<ApiKeySummary> = {}): ApiKeySummary {
  return {
    id: "k1",
    label: "CI",
    prefix: "sk_a1b2c3d",
    scopes: ["diagrams"],
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  }
}

describe("ApiKeyManager", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    writeText.mockClear()
    writeText.mockResolvedValue(undefined)
  })

  it("renders empty state when there are no keys", () => {
    render(<ApiKeyManager initialKeys={[]} />)
    expect(screen.getByText("No API keys yet.")).toBeInTheDocument()
  })

  it("renders label, masked prefix and 'never used'", () => {
    render(<ApiKeyManager initialKeys={[summary()]} />)
    expect(screen.getByText("CI")).toBeInTheDocument()
    expect(screen.getByText("sk_a1b2c3d…")).toBeInTheDocument()
    expect(screen.getByText("never used")).toBeInTheDocument()
  })

  it("shows a revoked badge for a revoked key and hides its Revoke button", () => {
    render(
      <ApiKeyManager initialKeys={[summary({ revokedAt: new Date("2026-02-01") })]} />
    )
    expect(screen.getByText("revoked")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument()
  })

  it("creates a key and reveals the raw secret exactly once", async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "k2", key: "sk_secretraw", prefix: "sk_secret", label: "API key" }),
    })

    render(<ApiKeyManager initialKeys={[]} />)
    await user.click(screen.getByRole("button", { name: "Create key" }))

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/api-keys",
      expect.objectContaining({ method: "POST" })
    )
    const reveal = screen.getByTestId("revealed-key")
    expect(reveal).toHaveTextContent("sk_secretraw")

    // dismissing hides the secret permanently
    await user.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.queryByTestId("revealed-key")).not.toBeInTheDocument()
    expect(screen.queryByText("sk_secretraw")).not.toBeInTheDocument()
  })

  it("copies the revealed key to the clipboard", async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: { writeText },
    })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "k2", key: "sk_copyme", prefix: "sk_copyme", label: "API key" }),
    })

    render(<ApiKeyManager initialKeys={[]} />)
    await user.click(screen.getByRole("button", { name: "Create key" }))
    await user.click(screen.getByRole("button", { name: "Copy" }))
    expect(writeText).toHaveBeenCalledWith("sk_copyme")
  })

  it("requires a confirm step before revoking", async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    render(<ApiKeyManager initialKeys={[summary()]} />)

    // first click only arms the confirm — no fetch yet
    await user.click(screen.getByRole("button", { name: "Revoke" }))
    expect(global.fetch).not.toHaveBeenCalled()

    // confirm fires the DELETE and flips the row to revoked
    await user.click(screen.getByRole("button", { name: "Confirm" }))
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/api-keys/k1",
      expect.objectContaining({ method: "DELETE" })
    )
    expect(await screen.findByText("revoked")).toBeInTheDocument()
  })

  it("can cancel a revoke without calling the API", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
    render(<ApiKeyManager initialKeys={[summary()]} />)
    await user.click(screen.getByRole("button", { name: "Revoke" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument()
  })
})
