"use client"

import { useEffect, useRef } from "react"
import { addActiveSeconds } from "@/lib/site-activity"

const TICK_MS = 30_000

/** Records time-on-site while the tab is visible. Mount once in the root layout. */
export function SiteActivityTracker() {
  const lastTick = useRef<number | null>(null)

  useEffect(() => {
    function flushElapsed() {
      if (document.visibilityState !== "visible") {
        lastTick.current = null
        return
      }
      const now = Date.now()
      if (lastTick.current !== null) {
        const elapsedSec = (now - lastTick.current) / 1000
        if (elapsedSec >= 1) addActiveSeconds(elapsedSec)
      }
      lastTick.current = now
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushElapsed()
        lastTick.current = null
      } else {
        lastTick.current = Date.now()
      }
    }

    lastTick.current = Date.now()
    const id = setInterval(flushElapsed, TICK_MS)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", flushElapsed)

    return () => {
      flushElapsed()
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", flushElapsed)
    }
  }, [])

  return null
}
