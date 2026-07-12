import { requireSession } from "@/lib/auth"
import { listApiKeys } from "@/lib/api-key"
import { ApiKeyManager } from "@/components/settings/ApiKeyManager"

export default async function ApiKeysSettingsPage() {
  const session = await requireSession()
  const keys = await listApiKeys(session.user.id)

  return (
    <main className="min-h-screen bg-zinc-950">
      <ApiKeyManager initialKeys={keys} />
    </main>
  )
}
