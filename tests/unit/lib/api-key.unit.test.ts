import { describe, it, expect } from "vitest"
import { generateApiKey, hashApiKey, resolveApiKey } from "@/lib/api-key"

describe("generateApiKey", () => {
  it("produces an sk_-prefixed raw secret", () => {
    const { raw } = generateApiKey()
    expect(raw.startsWith("sk_")).toBe(true)
  })

  it("carries >= 256 bits of entropy in the raw secret", () => {
    // base64url of 32 random bytes ≈ 43 chars after the sk_ prefix
    const { raw } = generateApiKey()
    const body = raw.slice("sk_".length)
    expect(body.length).toBeGreaterThanOrEqual(43)
  })

  it("hashedKey matches hashApiKey(raw)", () => {
    const { raw, hashedKey } = generateApiKey()
    expect(hashedKey).toBe(hashApiKey(raw))
  })

  it("prefix is the first 11 chars of the raw secret", () => {
    const { raw, prefix } = generateApiKey()
    expect(prefix).toBe(raw.slice(0, 11))
    expect(prefix.startsWith("sk_")).toBe(true)
  })

  it("generates unique secrets across calls", () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.raw).not.toBe(b.raw)
    expect(a.hashedKey).not.toBe(b.hashedKey)
  })
})

describe("hashApiKey", () => {
  it("is deterministic", () => {
    expect(hashApiKey("sk_abc")).toBe(hashApiKey("sk_abc"))
  })

  it("returns a 64-char hex sha-256 digest", () => {
    expect(hashApiKey("sk_abc")).toMatch(/^[0-9a-f]{64}$/)
  })

  it("differs for different inputs", () => {
    expect(hashApiKey("sk_a")).not.toBe(hashApiKey("sk_b"))
  })
})

describe("resolveApiKey (guard clauses, no DB)", () => {
  it("returns null for empty input without hitting the DB", async () => {
    expect(await resolveApiKey("")).toBeNull()
    expect(await resolveApiKey(null)).toBeNull()
    expect(await resolveApiKey(undefined)).toBeNull()
  })

  it("returns null for a non-sk_ prefixed key without hitting the DB", async () => {
    expect(await resolveApiKey("not-a-key")).toBeNull()
    expect(await resolveApiKey("Bearer sk_x")).toBeNull()
  })
})
