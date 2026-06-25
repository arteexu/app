import type { Metadata } from "next"
import { Inter, Baloo_2 } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { BoardPreferencesProvider } from "@/components/BoardPreferencesProvider"
import { SiteActivityTracker } from "@/components/SiteActivityTracker"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const baloo = Baloo_2({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-baloo" })

export const metadata: Metadata = {
  title: "ChessMind — Learn Chess by Doing",
  description: "Interactive, hands-on chess lessons for middle and high school students.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      {/* Runs before React hydrates — prevents flash of wrong theme */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('chessmind-theme');
            if (t === 'dark') document.documentElement.classList.add('dark');
          } catch(e) {}
        `}} />
      </head>
      <body className={`${inter.variable} ${baloo.variable} font-sans min-h-full`}>
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
