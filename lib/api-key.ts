import { createHash, randomBytes } from "node:crypto"
import { db } from "@/lib/db"

const KEY_PREFIX = "sk_"
const PREFIX_DISPLAY_LEN = 11 // "sk_" + 8 chars

/** Don't re-bump `lastUsedAt` more often than this — halves write traffic under MCP polling. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000

export type ApiKeySummary = {
  id: string
  label: string
  prefix: string
  scopes: string[]
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

const SUMMARY_SELECT = {
  id: true,
  label: true,
  prefix: true,
  scopes: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const

/** sha-256 hex of the raw key. Deterministic → uniquely indexable for O(1) lookup. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

/** Generate a fresh key. `raw` is the only place the secret ever exists in plaintext. */
export function generateApiKey(): { raw: string; hashedKey: string; prefix: string } {
  const raw = KEY_PREFIX + randomBytes(32).toString("base64url")
  return {
    raw,
    hashedKey: hashApiKey(raw),
    prefix: raw.slice(0, PREFIX_DISPLAY_LEN),
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  )
}

/**
 * Mint a key for a user. Persists only the hash + display prefix; returns the raw
 * secret exactly once. Retries on the (astronomically unlikely) hash collision.
 */
export async function createApiKey(
  userId: string,
  label?: string
): Promise<{ id: string; raw: string; prefix: string; label: string; scopes: string[] }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { raw, hashedKey, prefix } = generateApiKey()
    try {
      const row = await db.apiKey.create({
        data: {
          userId,
          hashedKey,
          prefix,
          ...(label ? { label } : {}),
        },
        select: { id: true, label: true, scopes: true },
      })
      return { id: row.id, raw, prefix, label: row.label, scopes: row.scopes }
    } catch (err) {
      if (isPrismaUniqueViolation(err) && attempt < 2) continue
      throw err
    }
  }
  // Unreachable in practice — 3 CSPRNG collisions is effectively impossible.
  throw new Error("Failed to generate a unique API key")
}

/** List a user's keys — metadata only. Never selects `hashedKey`. Includes revoked rows. */
export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  return db.apiKey.findMany({
    where: { userId },
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
  })
}

/** Revoke an owned key. Owner-scoped; returns false when not owned / already gone. */
export async function revokeApiKey(id: string, userId: string): Promise<boolean> {
  const result = await db.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count > 0
}

/**
 * Resolve a raw bearer key to its owner. Returns null for malformed / unknown /
 * revoked keys. Bumps `lastUsedAt` best-effort (never blocks the request).
 */
export async function resolveApiKey(
  raw: string | null | undefined
): Promise<{ userId: string; scopes: string[] } | null> {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null

  const hashedKey = hashApiKey(raw)
  const row = await db.apiKey.findUnique({
    where: { hashedKey },
    select: { id: true, userId: true, scopes: true, revokedAt: true, lastUsedAt: true },
  })
  if (!row || row.revokedAt) return null

  // Best-effort usage tracking — failures must not fail auth. Throttled so we
  // don't add a write on every request (MCP polling would otherwise double it).
  const now = Date.now()
  const stale =
    !row.lastUsedAt || now - row.lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS
  if (stale) {
    try {
      await db.apiKey.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date(now) },
      })
    } catch {
      // swallow
    }
  }

  return { userId: row.userId, scopes: row.scopes }
}
