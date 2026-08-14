'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  FileText,
  Network,
  Users,
  Hash,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  LogOut,
  UserCircle2,
  Palette,
  Check,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logoutAction } from '@/server/actions/auth.actions'
import { setTemaAction } from '@/server/actions/preferences.actions'
import { TEMAS, canModule, type SesionUsuario, type Modulo } from '@/server/domain/constants'

export interface NavItem {
  href: string
  label: string
  modulo: Modulo
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', modulo: 'reportes' },
  { href: '/documentos', label: 'Documentos', modulo: 'documentos' },
  { href: '/areas', label: 'Áreas y Puestos', modulo: 'areas' },
  { href: '/usuarios', label: 'Usuarios', modulo: 'usuarios' },
  { href: '/contadores', label: 'Numeración', modulo: 'contadores' },
  { href: '/configuracion', label: 'Configuración', modulo: 'usuarios' },
]

const ICONS: Record<string, React.ElementType> = {
  '/dashboard': LayoutDashboard,
  '/documentos': FileText,
  '/areas': Network,
  '/usuarios': Users,
  '/contadores': Hash,
  '/configuracion': Settings,
}

const TITULOS: Array<[string, string]> = [
  ['/documentos/nuevo', 'Nuevo documento'],
  ['/documentos', 'Documentos'],
  ['/areas', 'Áreas y Puestos'],
  ['/usuarios', 'Usuarios'],
  ['/contadores', 'Numeración'],
  ['/configuracion', 'Configuración'],
  ['/dashboard', 'Dashboard'],
]

const TEMA_LABEL: Record<string, string> = {
  'carto-light': 'Carto claro',
  'carto-dark': 'Carto oscuro',
  'neon-light': 'Neon claro',
  'neon-dark': 'Neon oscuro',
  consola: 'Consola',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() ?? '?'
}

export function AppShell({
  user,
  children,
}: {
  user: SesionUsuario
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const cambiarTema = (tema: string) => {
    setTheme(tema)
    void setTemaAction(tema)
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('carto:sidebar')
    if (stored) {
      const id = setTimeout(() => setCollapsed(stored === '1'), 0)
      return () => clearTimeout(id)
    }
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      window.localStorage.setItem('carto:sidebar', c ? '0' : '1')
      return !c
    })
  }

  const nav = NAV.filter((item) => {
    if (item.href === '/dashboard') return true
    if (item.href === '/configuracion') return user.role === 'admin'
    return canModule(user, item.modulo)
  })

  const titulo = TITULOS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? 'Carto'

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className={cn('flex h-14 items-center gap-2 border-b border-sidebar-border px-3', collapsed && 'justify-center px-0')}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground glow-box">
            C
          </span>
          {!collapsed && (
            <span className="truncate text-lg font-semibold tracking-tight">
              Carto<span className="text-neon">.</span>
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {nav.map((item) => {
            const Icon = ICONS[item.href] ?? LayoutDashboard
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full justify-start gap-3', collapsed && 'justify-center px-0')}
            onClick={toggle}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Colapsar</span>}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold">{titulo}</h1>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Cambiar tema">
                  <Palette className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Tema de la aplicación</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TEMAS.map((t) => (
                  <DropdownMenuItem key={t} onSelect={() => cambiarTema(t)} className="flex items-center justify-between">
                    {TEMA_LABEL[t]}
                    {theme === t && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm sm:block">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2 text-sm">
                    <UserCircle2 className="h-4 w-4" />
                    <span className="truncate">{user.name}</span>
                  </div>
                  <div className="mt-1 truncate text-xs font-normal text-muted-foreground">{user.email}</div>
                  <div className="mt-1 text-xs font-normal text-muted-foreground">
                    {user.asignacionActiva ? `${user.asignacionActiva.areaName} · ${user.asignacionActiva.puestoName ?? '—'}` : 'Sin área asignada'}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logoutAction()}>
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="w-full flex-1 p-4 sm:p-6">{children}</main>
        <footer className="flex items-center justify-center gap-1.5 border-t px-4 py-3 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Sistema de numeración de comunicaciones internas y oficios externos
        </footer>
      </div>
    </div>
  )
}