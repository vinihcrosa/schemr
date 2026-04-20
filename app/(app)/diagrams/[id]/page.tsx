import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth"
import { getDiagramById } from "@/lib/diagrams"
import { ExcalidrawEditor } from "@/components/excalidraw/ExcalidrawEditor"

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
  const diagram = await getDiagramById(id, session!.user.id)

  if (!diagram) notFound()

  return (
    <main className="h-screen w-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <ExcalidrawEditor
          initialData={diagram.data}
          diagramId={diagram.id}
        />
      </div>
    </main>
  )
}
