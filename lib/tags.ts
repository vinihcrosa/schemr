import { db } from "@/lib/db"

export type TagSummary = { id: string; name: string }

export async function listTags(userId: string): Promise<TagSummary[]> {
  return db.tag.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

export async function createTag(userId: string, name: string): Promise<TagSummary> {
  return db.tag.create({
    data: { userId, name: name.trim() },
    select: { id: true, name: true },
  })
}

export async function deleteTag(userId: string, tagId: string): Promise<void> {
  const tag = await db.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) throw new Error("not found")
  await db.tag.delete({ where: { id: tagId } })
}

export async function assignTag(
  userId: string,
  diagramId: string,
  tagId: string
): Promise<void> {
  const [diagram, tag] = await Promise.all([
    db.diagram.findFirst({ where: { id: diagramId, userId } }),
    db.tag.findFirst({ where: { id: tagId, userId } }),
  ])
  if (!diagram || !tag) throw new Error("not found")
  await db.diagramTag.upsert({
    where: { diagramId_tagId: { diagramId, tagId } },
    create: { diagramId, tagId },
    update: {},
  })
}

export async function removeTag(
  userId: string,
  diagramId: string,
  tagId: string
): Promise<void> {
  const diagram = await db.diagram.findFirst({ where: { id: diagramId, userId } })
  if (!diagram) throw new Error("not found")
  await db.diagramTag.deleteMany({ where: { diagramId, tagId } })
}
