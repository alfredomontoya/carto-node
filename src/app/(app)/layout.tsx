import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getCurrentUser } from '@/server/auth/dal'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.active) redirect('/login')
  return <AppShell user={usuario}>{children}</AppShell>
}