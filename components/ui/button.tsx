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
        // Bitcoin DeFi: pill shape, snappier transitions, accent focus ring
        "bitcoin:rounded-full bitcoin:gap-2 bitcoin:duration-300",
        "bitcoin:focus:ring-[#F7931A] bitcoin:focus:ring-offset-[#030304]",
        "bitcoin:disabled:hover:scale-100",

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
          // Bitcoin DeFi: gradient pill that emits orange light
          "bitcoin:bg-gradient-to-r bitcoin:from-[#EA580C] bitcoin:to-[#F7931A] bitcoin:focus:ring-[#F7931A]",
          "bitcoin:shadow-[0_0_20px_-5px_rgba(234,88,12,0.5)]",
          "bitcoin:hover:translate-y-0 bitcoin:hover:scale-105 bitcoin:hover:shadow-[0_0_30px_-5px_rgba(247,147,26,0.6)]",
          "bitcoin:active:translate-y-0 bitcoin:active:scale-100 bitcoin:active:shadow-[0_0_20px_-5px_rgba(234,88,12,0.5)]",
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
          // Bitcoin DeFi: outline that fills on hover
          "bitcoin:bg-transparent bitcoin:text-white bitcoin:border-2 bitcoin:border-white/20 bitcoin:shadow-none bitcoin:focus:ring-[#F7931A]",
          "bitcoin:hover:bg-white/10 bitcoin:hover:border-white bitcoin:hover:shadow-none bitcoin:hover:translate-y-0",
          "bitcoin:active:bg-white/10 bitcoin:active:shadow-none bitcoin:active:translate-y-0",
        ],

        // ── Ghost — no background, subtle lift on hover ───────────────────────
        variant === "ghost" && [
          "text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500",
          "hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:shadow-sm hover:-translate-y-px",
          "active:translate-y-px active:shadow-none",
          // Bitcoin DeFi: transparent, warms to orange on hover
          "bitcoin:text-white bitcoin:focus:ring-[#F7931A]",
          "bitcoin:hover:bg-white/10 bitcoin:hover:text-[#F7931A] bitcoin:hover:shadow-none bitcoin:hover:translate-y-0",
          "bitcoin:active:translate-y-0 bitcoin:active:shadow-none",
        ],

        // ── Sizes ─────────────────────────────────────────────────────────────
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-5 py-2.5 text-base bitcoin:min-h-[44px]",
        size === "lg" && "px-7 py-3.5 text-lg bitcoin:min-h-[48px]",

        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
