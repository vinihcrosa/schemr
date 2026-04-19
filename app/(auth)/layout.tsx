import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (session) redirect("/")

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      {children}
    </div>
  )
}
