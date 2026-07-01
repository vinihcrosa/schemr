import { notFound } from "next/navigation"
import { getDiagramByShareToken } from "@/lib/diagrams"
import { ShareCanvas } from "@/components/excalidraw/ShareCanvas"

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const shared = await getDiagramByShareToken(token)
  if (!shared) notFound()

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ShareCanvas data={shared.data} name={shared.name} />
    </div>
  )
}
