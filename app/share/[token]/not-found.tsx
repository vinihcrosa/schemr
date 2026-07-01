export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-zinc-300">This link is no longer available.</p>
        <p className="text-xs text-zinc-500">
          The diagram may have been unshared or deleted.
        </p>
      </div>
    </main>
  )
}
