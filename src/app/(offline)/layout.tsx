import type { Metadata } from 'next'
import { Globe } from 'lucide-react'

export const metadata: Metadata = { title: 'Fuera de línea' }

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground glow-box">
          C
        </span>
        <div className="text-xl font-semibold tracking-tight">
          Carto<span className="text-neon">.</span>
        </div>
      </div>
      {children}
      <footer className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        Comunicaciones internas y oficios externos
      </footer>
    </div>
  )
}
