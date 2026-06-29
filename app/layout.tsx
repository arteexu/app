import type { Metadata } from "next"
import { Inter, Baloo_2, Space_Grotesk, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { BoardPreferencesProvider } from "@/components/BoardPreferencesProvider"
import { SiteActivityTracker } from "@/components/SiteActivityTracker"

// Default brand: Inter body + Baloo 2 display.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const baloo = Baloo_2({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-baloo" })
// Loaded but only used by the opt-in "Bitcoin DeFi" theme.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
})

export const metadata: Metadata = {
  title: "ChessMind — Learn Chess by Doing",
  description: "Interactive, hands-on chess lessons for middle and high school students.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      {/* Runs before React hydrates — applies the saved theme to avoid a flash. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('chessmind-theme');
            const el = document.documentElement;
            if (t === 'dark') el.classList.add('dark');
            else if (t === 'bitcoin') { el.classList.add('dark'); el.setAttribute('data-theme', 'bitcoin'); }
          } catch(e) {}
        `}} />
      </head>
      <body className={`${inter.variable} ${baloo.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans min-h-full overflow-x-hidden`}>
        <ThemeProvider>
          <BoardPreferencesProvider>
            <SiteActivityTracker />
            {children}
          </BoardPreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
