import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth"
import { getDiagramById, listDiagrams } from "@/lib/diagrams"
import { ExcalidrawEditor } from "@/components/excalidraw/ExcalidrawEditor"
import { DiagramSidebar } from "@/components/sidebar/DiagramSidebar"

export default async function DiagramPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  let session
  try {
    session = await requireSession()
  } catch {
    notFound()
  }

  const { id } = await params
  const [diagram, diagrams] = await Promise.all([
    getDiagramById(id, session!.user.id),
    listDiagrams(session!.user.id),
  ])

  if (!diagram) notFound()

  const serialized = diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    updatedAt: d.updatedAt.toISOString(),
  }))

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <DiagramSidebar diagrams={serialized} currentId={id} />
      <main className="flex-1 overflow-hidden">
        <ExcalidrawEditor initialData={diagram.data} diagramId={diagram.id} />
      </main>
    </div>
  )
}
