"use client"
import { createContext, useContext, useEffect, useState } from "react"

// "light" / "dark" are the original brand. "bitcoin" is the opt-in Bitcoin DeFi
// theme: it turns on .dark (so not-yet-themed pages stay legible on the void) and
// sets data-theme="bitcoin" to activate the gated `bitcoin:` utilities.
export type Theme = "light" | "dark" | "bitcoin"

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "light",
  setTheme: () => {},
})

function applyTheme(theme: Theme) {
  const el = document.documentElement
  el.classList.toggle("dark", theme === "dark" || theme === "bitcoin")
  if (theme === "bitcoin") {
    el.setAttribute("data-theme", "bitcoin")
  } else {
    el.removeAttribute("data-theme")
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    const stored = (localStorage.getItem("chessmind-theme") as Theme) ?? "light"
    setThemeState(stored)
    applyTheme(stored)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem("chessmind-theme", t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
