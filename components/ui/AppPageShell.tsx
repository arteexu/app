import { SiteFooter } from "./SiteFooter"

interface Props {
  nav: React.ReactNode
  children: React.ReactNode
  /** Hide footer on fullscreen experiences (e.g. solitaire play). Default: show. */
  showFooter?: boolean
}

export function AppPageShell({ nav, children, showFooter = true }: Props) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {nav}
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      {showFooter && <SiteFooter />}
    </div>
  )
}
