"use client"

import { useState } from "react"
import type { ApiKeySummary } from "@/lib/api-key"

type Props = {
  initialKeys: ApiKeySummary[]
}

// The list carries dates as ISO strings once it round-trips through JSON.
type KeyRow = Omit<ApiKeySummary, "lastUsedAt" | "revokedAt" | "createdAt"> & {
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

type RevokeMode = { id: string } | null

export function ApiKeyManager({ initialKeys }: Props) {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys as unknown as KeyRow[])
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeMode, setRevokeMode] = useState<RevokeMode>(null)

  const clipboardAvailable =
    typeof navigator !== "undefined" && !!navigator.clipboard

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setRevealed(null)
    setCopied(false)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(label.trim() ? { label: label.trim() } : {}),
      })
      if (!res.ok) {
        setError("Could not create key")
        return
      }
      const data = await res.json()
      setRevealed(data.key)
      setLabel("")
      setKeys((prev) => [
        {
          id: data.id,
          label: data.label,
          prefix: data.prefix,
          scopes: ["diagrams"],
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
    } catch {
      setError("Could not create key")
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function dismissReveal() {
    setRevealed(null)
    setCopied(false)
  }

  async function handleConfirmRevoke(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setError("Could not revoke key")
        return
      }
      setKeys((prev) =>
        prev.map((k) =>
          k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k
        )
      )
      setRevokeMode(null)
    } catch {
      setError("Could not revoke key")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 text-zinc-200">
      <h1 className="mb-1 text-lg font-semibold">API keys</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Use an API key to let a headless client (like the diagram MCP server) act
        on your behalf. A key can read and write your diagrams — treat it like a
        password.
      </p>

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          aria-label="New key label"
          maxLength={80}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Create key
        </button>
      </form>

      {revealed && (
        <div
          data-testid="revealed-key"
          className="mb-6 rounded-lg border border-amber-600/40 bg-amber-950/30 p-3"
        >
          <p className="mb-2 text-xs font-medium text-amber-300">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <p
            data-testid="revealed-key-value"
            className="mb-2 break-all rounded bg-zinc-900 px-2 py-1 font-mono text-[12px] text-zinc-100"
          >
            {revealed}
          </p>
          <div className="flex gap-2">
            {clipboardAvailable && (
              <button
                onClick={handleCopy}
                className="rounded-md bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-600"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            <button
              onClick={dismissReveal}
              className="rounded-md px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {keys.length === 0 ? (
        <p className="text-sm text-zinc-500">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {keys.map((k) => {
            const isRevoked = k.revokedAt !== null
            return (
              <li
                key={k.id}
                data-testid="api-key-row"
                className="flex items-center justify-between px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-200">
                      {k.label}
                    </span>
                    {isRevoked && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300">
                        revoked
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-mono">{k.prefix}…</span>
                    <span aria-hidden>·</span>
                    <span>
                      {k.lastUsedAt
                        ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                        : "never used"}
                    </span>
                  </div>
                </div>

                {!isRevoked &&
                  (revokeMode?.id === k.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">Revoke?</span>
                      <button
                        onClick={() => setRevokeMode(null)}
                        className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleConfirmRevoke(k.id)}
                        disabled={busy}
                        className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokeMode({ id: k.id })}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-950/40"
                    >
                      Revoke
                    </button>
                  ))}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
