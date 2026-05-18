import { db } from "@/lib/db"

export type FolderSummary = {
  id: string
  name: string
  parentFolderId: string | null
  updatedAt: Date
}

export async function listFolders(userId: string): Promise<FolderSummary[]> {
  return db.folder.findMany({
    where: { userId },
    select: { id: true, name: true, parentFolderId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  })
}

export async function createFolder(
  userId: string,
  name?: string,
  parentFolderId?: string | null
): Promise<FolderSummary> {
  return db.folder.create({
    data: {
      userId,
      name: name ?? "New Folder",
      parentFolderId: parentFolderId ?? null,
    },
    select: { id: true, name: true, parentFolderId: true, updatedAt: true },
  })
}

export async function updateFolder(
  id: string,
  userId: string,
  patch: { name?: string; parentFolderId?: string | null }
): Promise<FolderSummary | null> {
  const result = await db.folder.updateMany({
    where: { id, userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.parentFolderId !== undefined ? { parentFolderId: patch.parentFolderId } : {}),
    },
  })
  if (result.count === 0) return null
  return db.folder.findFirst({
    where: { id },
    select: { id: true, name: true, parentFolderId: true, updatedAt: true },
  })
}

export async function deleteFolder(id: string, userId: string): Promise<boolean> {
  const folder = await db.folder.findFirst({ where: { id, userId } })
  if (!folder) return false

  await db.$transaction([
    db.diagram.updateMany({ where: { folderId: id }, data: { folderId: null } }),
    db.folder.updateMany({ where: { parentFolderId: id }, data: { parentFolderId: null } }),
    db.folder.delete({ where: { id } }),
  ])
  return true
}
