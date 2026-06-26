"use client"

import { clsx } from "clsx"

interface Props {
  children: string
  className?: string
  /** Split on blank lines into multiple paragraphs. Defaults to true when text contains \n\n. */
  paragraphs?: boolean
  strongClassName?: string
}

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; intro?: string; ordered: boolean; items: string[] }

/** Renders trusted course JSON strings with inline **bold**, *italic*, and simple lists. */
export function MarkdownText({ children, className, paragraphs, strongClassName }: Props) {
  const useParagraphs = paragraphs ?? children.includes("\n\n")

  if (useParagraphs) {
    return (
      <div className={clsx("flex flex-col gap-3", className)}>
        {parseBlocks(children).map((block, i) =>
          block.kind === "list"
            ? renderList(block, i, strongClassName)
            : renderParagraph(block.text, i, strongClassName)
        )}
      </div>
    )
  }

  return <>{renderInline(children, strongClassName)}</>
}

function parseBlocks(text: string): Block[] {
  return text.split("\n\n").filter(Boolean).map(parseBlock)
}

function parseBlock(block: string): Block {
  const lines = block.split("\n")
  const listStart = lines.findIndex(line => /^-\s/.test(line) || /^\d+\.\s/.test(line))

  if (listStart === -1) {
    return { kind: "paragraph", text: block }
  }

  const intro = lines.slice(0, listStart).join("\n").trim() || undefined
  const listLines = lines.slice(listStart)
  const ordered = /^\d+\.\s/.test(listLines[0])

  const items = listLines.map(line =>
    ordered ? line.replace(/^\d+\.\s/, "") : line.replace(/^-\s/, "")
  )

  return { kind: "list", intro, ordered, items }
}

function renderParagraph(text: string, key: number, strongClassName?: string) {
  const lines = text.split("\n")

  if (lines.length === 1) {
    return <p key={key}>{renderInline(text, strongClassName)}</p>
  }

  return (
    <p key={key}>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {renderInline(line, strongClassName)}
        </span>
      ))}
    </p>
  )
}

function renderList(block: Extract<Block, { kind: "list" }>, key: number, strongClassName?: string) {
  const Tag = block.ordered ? "ol" : "ul"
  const listClass = block.ordered
    ? "list-decimal pl-5 flex flex-col gap-1.5 marker:text-gray-500 dark:marker:text-slate-400"
    : "list-disc pl-5 flex flex-col gap-1.5 marker:text-gray-500 dark:marker:text-slate-400"

  return (
    <div key={key} className="flex flex-col gap-2">
      {block.intro && <p>{renderInline(block.intro, strongClassName)}</p>}
      <Tag className={listClass}>
        {block.items.map((item, i) => (
          <li key={i}>{renderInline(item, strongClassName)}</li>
        ))}
      </Tag>
    </div>
  )
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
