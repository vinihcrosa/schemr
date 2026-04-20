"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"

type Props = {
  name: string
}

export function UserMenu({ name }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const initial = name.trim().charAt(0).toUpperCase()

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full bg-zinc-600 hover:bg-zinc-500 text-zinc-100 text-xs font-semibold flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
        aria-label="User menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-44 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-zinc-700">
            <p className="text-zinc-300 text-xs font-medium truncate">{name}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            className="w-full text-left px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
