export type DiagramEntry = {
  id: string
  name: string
  updatedAt: string
  folderId: string | null
  thumbnail?: string | null
}

export type FolderSummary = {
  id: string
  name: string
  parentFolderId: string | null
}

export type FolderNode = {
  id: string
  name: string
  parentFolderId: string | null
  children: FolderNode[]
  diagrams: DiagramEntry[]
}

export type SidebarData = {
  folders: FolderNode[]
  rootDiagrams: DiagramEntry[]
}

export function buildSidebarTree(
  folders: FolderSummary[],
  diagrams: DiagramEntry[]
): SidebarData {
  const nodeMap = new Map<string, FolderNode>()

  for (const f of folders) {
    nodeMap.set(f.id, {
      id: f.id,
      name: f.name,
      parentFolderId: f.parentFolderId,
      children: [],
      diagrams: [],
    })
  }

  for (const d of diagrams) {
    if (d.folderId && nodeMap.has(d.folderId)) {
      nodeMap.get(d.folderId)!.diagrams.push(d)
    }
  }

  const rootFolders: FolderNode[] = []

  for (const node of nodeMap.values()) {
    if (node.parentFolderId && nodeMap.has(node.parentFolderId)) {
      nodeMap.get(node.parentFolderId)!.children.push(node)
    } else {
      rootFolders.push(node)
    }
  }

  const rootDiagrams = diagrams.filter((d) => !d.folderId || !nodeMap.has(d.folderId))

  return { folders: rootFolders, rootDiagrams }
}

export function isDescendant(
  folders: FolderSummary[],
  ancestorId: string,
  candidateId: string
): boolean {
  if (candidateId === ancestorId) return false

  const parentMap = new Map<string, string | null>()
  for (const f of folders) {
    parentMap.set(f.id, f.parentFolderId)
  }

  let current: string | null | undefined = parentMap.get(candidateId)
  while (current != null) {
    if (current === ancestorId) return true
    current = parentMap.get(current)
  }
  return false
}
