import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth"
import { getDiagramById, listDiagrams } from "@/lib/diagrams"
import { listFolders } from "@/lib/folders"
import { buildSidebarTree } from "@/lib/sidebar-tree"
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
  const [diagram, diagrams, folders] = await Promise.all([
    getDiagramById(id, session!.user.id),
    listDiagrams(session!.user.id),
    listFolders(session!.user.id),
  ])

  if (!diagram) notFound()

  const diagramEntries = diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    updatedAt: d.updatedAt.toISOString(),
    folderId: d.folderId,
    thumbnail: d.thumbnail,
  }))

  const folderSummaries = folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentFolderId: f.parentFolderId,
  }))

  const sidebarData = buildSidebarTree(folderSummaries, diagramEntries)

  const userName = session!.user.name ?? session!.user.email ?? "?"

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <DiagramSidebar initialData={sidebarData} currentId={id} userName={userName} />
      <main className="flex-1 overflow-hidden">
        <ExcalidrawEditor initialData={diagram.data} diagramId={diagram.id} />
      </main>
    </div>
  )
}
