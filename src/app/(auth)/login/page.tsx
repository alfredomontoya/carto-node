import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const destino = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined

  return (
    <Card className="neon-card">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
        <CardDescription>Accede con tu nombre de usuario y contraseña.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={destino} />
      </CardContent>
    </Card>
  )
}