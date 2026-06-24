"use client"
import { clsx } from "clsx"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        // ── Base ──────────────────────────────────────────────────────────────
        "inline-flex items-center justify-center rounded-xl font-semibold select-none",
        "transition-all duration-100 focus:outline-none focus:ring-2 focus:ring-offset-2",
        // Disabled: flatten — no 3D, no movement
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0",

        // ── Primary — indigo, 3D bottom edge in indigo-900 ───────────────────
        variant === "primary" && [
          "bg-indigo-600 text-white focus:ring-indigo-500",
          // Raised: 5 px coloured bottom edge + ambient glow
          "shadow-[0_5px_0_#312e81,0_8px_20px_rgba(79,70,229,0.35)]",
          // Hover: darken + press down 2 px, edge shrinks to 3 px
          "hover:bg-indigo-700",
          "hover:shadow-[0_3px_0_#312e81,0_5px_12px_rgba(79,70,229,0.25)]",
          "hover:translate-y-[2px]",
          // Active/click: fully depressed, edge gone
          "active:bg-indigo-800",
          "active:shadow-[0_1px_0_#312e81,0_2px_4px_rgba(79,70,229,0.15)]",
          "active:translate-y-[4px]",
        ],

        // ── Secondary — white/slate, neutral bottom edge ──────────────────────
        variant === "secondary" && [
          "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200",
          "border border-gray-200 dark:border-slate-600 focus:ring-gray-300",
          // Raised: gray-300 / slate-900 bottom edge
          "shadow-[0_4px_0_#d1d5db,0_4px_12px_rgba(0,0,0,0.07)]",
          "dark:shadow-[0_4px_0_#0f172a,0_4px_12px_rgba(0,0,0,0.25)]",
          // Hover: darken surface + press down 2 px
          "hover:bg-gray-100 dark:hover:bg-slate-700",
          "hover:shadow-[0_2px_0_#d1d5db,0_2px_6px_rgba(0,0,0,0.06)]",
          "dark:hover:shadow-[0_2px_0_#0f172a,0_2px_6px_rgba(0,0,0,0.2)]",
          "hover:translate-y-[2px]",
          // Active: fully flat
          "active:bg-gray-200 dark:active:bg-slate-600",
          "active:shadow-none active:translate-y-[4px]",
        ],

        // ── Ghost — no background, subtle lift on hover ───────────────────────
        variant === "ghost" && [
          "text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500",
          "hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:shadow-sm hover:-translate-y-px",
          "active:translate-y-px active:shadow-none",
        ],

        // ── Sizes ─────────────────────────────────────────────────────────────
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-5 py-2.5 text-base",
        size === "lg" && "px-7 py-3.5 text-lg",

        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
