import { SiteFooter } from "./SiteFooter"

interface Props {
  nav: React.ReactNode
  children: React.ReactNode
  /** Hide footer on fullscreen experiences (e.g. solitaire play). Default: show. */
  showFooter?: boolean
}

export function AppPageShell({ nav, children, showFooter = true }: Props) {
  // Footerless pages are fullscreen board experiences (Play, Analysis): pin the
  // shell to exactly the viewport height so inner panels (e.g. the move list)
  // scroll internally instead of growing the page. Pages with a footer keep the
  // natural min-height layout so the footer sits below scrollable content.
  return (
    <div
      className={
        showFooter
          ? "min-h-screen flex flex-col overflow-x-hidden"
          : "h-screen flex flex-col overflow-hidden"
      }
    >
      {nav}
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      {showFooter && <SiteFooter />}
    </div>
  )
}
