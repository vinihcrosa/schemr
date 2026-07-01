"use client"

import { useState, useRef, useEffect } from "react"

type Props = {
  diagramId: string
  initialShareToken: string | null
}

type RevokeMode = "idle" | "confirm"

export function ShareControl({ diagramId, initialShareToken }: Props) {
  const [token, setToken] = useState<string | null>(initialShareToken)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeMode, setRevokeMode] = useState<RevokeMode>("idle")
  const [copyFailed, setCopyFailed] = useState(false)

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revokeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clipboardAvailable =
    !copyFailed && typeof navigator !== "undefined" && !!navigator.clipboard

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      if (revokeTimeoutRef.current) clearTimeout(revokeTimeoutRef.current)
    }
  }, [])

  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${token}`
      : token
        ? `/share/${token}`
        : ""

  async function handleEnable() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/share`, { method: "POST" })
      if (!res.ok) {
        setError("Could not enable public link")
        return
      }
      const data = await res.json()
      setToken(data.shareToken)
    } catch {
      setError("Could not enable public link")
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
    }
  }

  function handleFirstRevokeClick() {
    setError(null)
    setRevokeMode("confirm")
    revokeTimeoutRef.current = setTimeout(() => {
      setRevokeMode("idle")
    }, 3000)
  }

  function handleCancelRevoke() {
    if (revokeTimeoutRef.current) clearTimeout(revokeTimeoutRef.current)
    setRevokeMode("idle")
  }

  async function handleConfirmRevoke() {
    if (revokeTimeoutRef.current) clearTimeout(revokeTimeoutRef.current)
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/share`, { method: "DELETE" })
      if (!res.ok) {
        setError("Could not stop sharing")
        return
      }
      setToken(null)
      setCopied(false)
      setRevokeMode("idle")
    } catch {
      setError("Could not stop sharing")
    } finally {
      setBusy(false)
    }
  }

  function togglePopover() {
    setRevokeMode("idle")
    setError(null)
    setOpen((v) => !v)
  }

  const isShared = token !== null

  return (
    <div className="absolute top-3 left-3 z-50">
      <button
        onClick={togglePopover}
        className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 shadow hover:bg-zinc-700"
        aria-label="Share"
        aria-expanded={open}
      >
        {isShared && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
        )}
        Share
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          {!isShared ? (
            <>
              <p className="mb-2 text-xs text-zinc-400">
                This diagram is private. Enable a public link to share it.
              </p>
              <button
                onClick={handleEnable}
                disabled={busy}
                className="w-full rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Enable public link
              </button>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                  Public
                </span>
                <span className="text-xs text-zinc-500">Anyone with the link can view</span>
              </div>

              {clipboardAvailable ? (
                <p
                  data-testid="share-url"
                  className="mb-2 break-all rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300"
                >
                  {shareUrl}
                </p>
              ) : (
                <input
                  data-testid="share-url"
                  readOnly
                  value={shareUrl}
                  aria-label="Public share link"
                  ref={(el) => el?.select()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mb-2 w-full rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 outline-none"
                />
              )}

              {clipboardAvailable && (
                <button
                  onClick={handleCopy}
                  className="mb-2 w-full rounded-md bg-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-600"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              )}

              {revokeMode === "idle" ? (
                <button
                  onClick={handleFirstRevokeClick}
                  disabled={busy}
                  className="w-full rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                >
                  Stop sharing
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-zinc-400">Stop sharing?</span>
                  <button
                    onClick={handleCancelRevoke}
                    className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRevoke}
                    disabled={busy}
                    className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </>
          )}

          {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
