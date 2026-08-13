import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requireUser } from '@/server/auth/dal'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUser()
  if (!usuario) redirect('/login')
  return <AppShell user={usuario}>{children}</AppShell>
}