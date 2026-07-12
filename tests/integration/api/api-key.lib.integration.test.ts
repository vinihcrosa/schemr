import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/db"
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  resolveApiKey,
  hashApiKey,
} from "@/lib/api-key"

const TEST_EMAIL_DOMAIN = "@api-key-lib-test.example"

let userA: string
let userB: string

beforeEach(async () => {
  const ts = Date.now()
  userA = (
    await db.user.create({
      data: { email: `a_${ts}${TEST_EMAIL_DOMAIN}`, password: "h" },
      select: { id: true },
    })
  ).id
  userB = (
    await db.user.create({
      data: { email: `b_${ts}${TEST_EMAIL_DOMAIN}`, password: "h" },
      select: { id: true },
    })
  ).id
})

afterEach(async () => {
  await db.user.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
})

describe("createApiKey", () => {
  it("returns the raw secret once and stores only its hash", async () => {
    const { id, raw, prefix } = await createApiKey(userA, "CI")
    expect(raw.startsWith("sk_")).toBe(true)
    expect(prefix).toBe(raw.slice(0, 11))

    const row = await db.apiKey.findUnique({ where: { id } })
    expect(row).not.toBeNull()
    expect(row!.hashedKey).toBe(hashApiKey(raw))
    // the raw secret is nowhere in the persisted row
    expect(JSON.stringify(row)).not.toContain(raw)
    expect(row!.label).toBe("CI")
  })

  it("defaults the label when omitted", async () => {
    const { id } = await createApiKey(userA)
    const row = await db.apiKey.findUnique({ where: { id } })
    expect(row!.label).toBe("API key")
    expect(row!.scopes).toEqual(["diagrams"])
  })
})

describe("listApiKeys", () => {
  it("returns metadata only — never the hash", async () => {
    await createApiKey(userA, "one")
    const keys = await listApiKeys(userA)
    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toHaveProperty("hashedKey")
    expect(Object.keys(keys[0]).sort()).toEqual(
      ["createdAt", "id", "label", "lastUsedAt", "prefix", "revokedAt", "scopes"].sort()
    )
  })

  it("is owner-scoped", async () => {
    await createApiKey(userA, "a")
    await createApiKey(userB, "b")
    expect(await listApiKeys(userA)).toHaveLength(1)
    expect(await listApiKeys(userB)).toHaveLength(1)
  })

  it("still lists revoked keys (audit trail)", async () => {
    const { id } = await createApiKey(userA)
    await revokeApiKey(id, userA)
    const keys = await listApiKeys(userA)
    expect(keys).toHaveLength(1)
    expect(keys[0].revokedAt).not.toBeNull()
  })
})

describe("resolveApiKey", () => {
  it("resolves a valid key to its owner", async () => {
    const { raw } = await createApiKey(userA)
    const resolved = await resolveApiKey(raw)
    expect(resolved).toEqual({ userId: userA, scopes: ["diagrams"] })
  })

  it("bumps lastUsedAt on success", async () => {
    const { id, raw } = await createApiKey(userA)
    expect((await db.apiKey.findUnique({ where: { id } }))!.lastUsedAt).toBeNull()
    await resolveApiKey(raw)
    expect((await db.apiKey.findUnique({ where: { id } }))!.lastUsedAt).not.toBeNull()
  })

  it("returns null for a revoked key", async () => {
    const { id, raw } = await createApiKey(userA)
    await revokeApiKey(id, userA)
    expect(await resolveApiKey(raw)).toBeNull()
  })

  it("returns null for an unknown key", async () => {
    expect(await resolveApiKey("sk_" + "x".repeat(43))).toBeNull()
  })
})

describe("revokeApiKey", () => {
  it("revokes an owned key", async () => {
    const { id } = await createApiKey(userA)
    expect(await revokeApiKey(id, userA)).toBe(true)
    expect((await db.apiKey.findUnique({ where: { id } }))!.revokedAt).not.toBeNull()
  })

  it("returns false and does not revoke another user's key", async () => {
    const { id } = await createApiKey(userA)
    expect(await revokeApiKey(id, userB)).toBe(false)
    expect((await db.apiKey.findUnique({ where: { id } }))!.revokedAt).toBeNull()
  })

  it("returns false when revoking an already-revoked key", async () => {
    const { id } = await createApiKey(userA)
    await revokeApiKey(id, userA)
    expect(await revokeApiKey(id, userA)).toBe(false)
  })
})
