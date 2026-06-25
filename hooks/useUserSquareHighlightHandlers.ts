import { useCallback, useRef } from "react"
import type { SquareHandlerArgs } from "react-chessboard"
import { toggleUserHighlight } from "@/lib/legal-move-highlights"

type HighlightSetter = React.Dispatch<React.SetStateAction<string[]>>

/**
 * Board handlers for chess.com-style right-click square markers.
 *
 * Desktop mouse: toggles only on same-square right-button release
 * (`onSquareMouseUp`). Nothing is highlighted while the button is held —
 * `onSquareRightClick` (contextmenu) is skipped whenever a mouse right-press
 * is in progress (`start !== null`).
 *
 * react-chessboard draws move arrows on right-click drag and suppresses
 * `onSquareRightClick` on the arrow's destination square (it sets
 * `isDrawingArrow` before `contextmenu` fires). Same-square toggles on
 * mouseup still work on arrow endpoints without toggling mid-drag (start ≠ end).
 *
 * Touch long-press has no mouse button events, so `onSquareRightClick` toggles
 * there. `toggleHandled` dedupes when contextmenu and mouseup both fire.
 */
export function useUserSquareHighlightHandlers(
  setUserHighlights: HighlightSetter,
  enabled = true,
) {
  const rightClickRef = useRef<{
    start: string | null
    /** True once mouseup or rightClick toggled for this press. */
    toggleHandled: boolean
    /** Suppresses the contextmenu toggle after an arrow draw (A→B mouseup). */
    suppressNextRightClick: boolean
  }>({
    start: null,
    toggleHandled: false,
    suppressNextRightClick: false,
  })

  const onSquareMouseDown = useCallback(
    ({ square }: SquareHandlerArgs, e: React.MouseEvent) => {
      if (!enabled || e.button !== 2) return
      rightClickRef.current = {
        start: square,
        toggleHandled: false,
        suppressNextRightClick: false,
      }
    },
    [enabled],
  )

  const onSquareMouseUp = useCallback(
    ({ square }: SquareHandlerArgs, e: React.MouseEvent) => {
      if (!enabled || e.button !== 2) return
      const { start } = rightClickRef.current
      if (!start) return

      // Right-click drag to a different square draws an arrow; react-chessboard
      // suppresses contextmenu on the destination, so mouseup is the only hook
      // for same-square toggles — but must not toggle on arrow completion.
      if (start !== square) {
        rightClickRef.current = {
          start: null,
          toggleHandled: false,
          suppressNextRightClick: true,
        }
        return
      }

      rightClickRef.current.start = null
      if (rightClickRef.current.toggleHandled) return

      rightClickRef.current.toggleHandled = true
      setUserHighlights(prev => toggleUserHighlight(prev, square))
    },
    [enabled, setUserHighlights],
  )

  const onSquareRightClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (!enabled) return
      // Mouse right-press in progress: wait for mouseup on the same square.
      if (rightClickRef.current.start !== null) return
      if (rightClickRef.current.suppressNextRightClick) {
        rightClickRef.current.suppressNextRightClick = false
        return
      }
      if (rightClickRef.current.toggleHandled) return

      rightClickRef.current.toggleHandled = true
      setUserHighlights(prev => toggleUserHighlight(prev, square))
    },
    [enabled, setUserHighlights],
  )

  return { onSquareMouseDown, onSquareMouseUp, onSquareRightClick }
}
