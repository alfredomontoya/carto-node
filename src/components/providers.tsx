'use client'

import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

// next-themes inyecta un <script> inline para aplicar el tema antes de la
// hidratación (evita parpadeo). React 19 avisa en desarrollo que los <script>
// dentro de componentes no se ejecutan en el cliente; es un falso positivo
// porque el script sí corre durante el SSR. Lo filtramos solo en dev.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) return
    originalError.apply(console, args)
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" storageKey="carto:tema" defaultTheme="carto-dark">
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      <Toaster richColors position="bottom-right" theme="system" />
    </ThemeProvider>
  )
}