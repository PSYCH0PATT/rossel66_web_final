import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import DashboardShell from "@/components/dashboard-shell"
import type { DashboardProfile } from "@/components/dashboard-user-context"

export default async function AdminDashboardRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")
  if (session.role !== "admin") notFound()

  const adminRow = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, name: true, avatarUrl: true },
  })

  const profile: DashboardProfile = {
    id: session.id,
    username: session.username,
    name: adminRow?.name || session.username,
    avatarUrl: adminRow?.avatarUrl ?? null,
    role: "admin",
  }

  return (
    <DashboardShell role="admin" requiredRole="admin" username={session.username} profile={profile}>
      {children}
    </DashboardShell>
  )
}
