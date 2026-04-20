import { redirect } from "next/navigation"
import { requireSession } from "@/lib/auth"
import { listDiagrams } from "@/lib/diagrams"
import { CreateFirstDiagramButton } from "./CreateFirstDiagramButton"

export default async function IndexPage() {
  const session = await requireSession()
  const diagrams = await listDiagrams(session.user.id)

  if (diagrams.length > 0) {
    redirect(`/diagrams/${diagrams[0].id}`)
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-zinc-500 text-sm">No diagrams yet.</p>
        <CreateFirstDiagramButton />
      </div>
    </main>
  )
}
