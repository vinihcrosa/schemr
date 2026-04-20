import { requireSession } from "@/lib/auth"
import { listDiagrams } from "@/lib/diagrams"
import { DiagramList } from "@/components/diagrams/DiagramList"

export default async function DiagramIndexPage() {
  const session = await requireSession()
  const diagrams = await listDiagrams(session.user.id)

  const serialized = diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    updatedAt: d.updatedAt.toISOString(),
  }))

  return (
    <main className="min-h-screen bg-zinc-950">
      <DiagramList diagrams={serialized} />
    </main>
  )
}
