import type { Metadata } from 'next'
import Script from 'next/script'
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const plusJakartaSans = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Carto — Comunicaciones y Oficios',
    template: '%s · Carto',
  },
  description: 'Sistema institucional de numeración de comunicaciones internas y oficios externos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="tema-inicial" strategy="beforeInteractive">
          {`(function(){try{var t=(document.cookie.match(/(?:^|; )carto_tema=([^;]+)/)||[])[1]||localStorage.getItem('carto:tema')||'carto-dark';if(!['carto-light','carto-dark','neon-light','neon-dark','consola'].includes(t))t='carto-dark';document.documentElement.dataset.theme=t;localStorage.setItem('carto:tema',t);}catch(e){}})();`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}