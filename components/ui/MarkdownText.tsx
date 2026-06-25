"use client"

import { clsx } from "clsx"

interface Props {
  children: string
  className?: string
  /** Split on blank lines into multiple paragraphs. Defaults to true when text contains \n\n. */
  paragraphs?: boolean
  strongClassName?: string
}

/** Renders trusted course JSON strings with inline **bold** and *italic* (no HTML). */
export function MarkdownText({ children, className, paragraphs, strongClassName }: Props) {
  const useParagraphs = paragraphs ?? children.includes("\n\n")

  if (useParagraphs) {
    return (
      <div className={clsx("flex flex-col gap-3", className)}>
        {children.split("\n\n").map((para, pi) => (
          <p key={pi}>{renderInline(para, strongClassName)}</p>
        ))}
      </div>
    )
  }

  return <>{renderInline(children, strongClassName)}</>
}

function renderInline(text: string, strongClassName?: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className={strongClassName}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <span key={i}>{part}</span>
  })
}
