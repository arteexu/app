"use client"
// components/analysis/MoveTreeList.tsx
// Renders a variation tree with main line inline and sibling branches in
// parentheses, e.g. "1. e4 e5 (1…d5) 2. Nf3".

import { useEffect, useRef, useState } from "react"
import { clsx } from "clsx"
import type { MovePath, MoveTree, MoveTreeNode, MoveNumbering } from "@/lib/analysis/move-tree"
import { pathKey, plyPrefix, positionBeforeMove, variationPrefix } from "@/lib/analysis/move-tree"
import { SanNotation } from "@/components/chess/SanNotation"
import { colorFromPly } from "@/lib/san-notation"

interface Props {
  tree: MoveTree
  cursorPath: MovePath
  numbering: MoveNumbering
  onNavigate: (path: MovePath) => void
  onStartVariation: (parentPath: MovePath) => void
}

interface MoveButtonProps {
  node: MoveTreeNode
  path: MovePath
  ply: number
  prefix: string
  active: boolean
  startWhite: boolean
  canAddVariation: boolean
  onNavigate: (path: MovePath) => void
  onStartVariation: (parentPath: MovePath) => void
  onContextMenu: (path: MovePath, x: number, y: number) => void
}

function MoveButton({
  node,
  path,
  ply,
  prefix,
  active,
  startWhite,
  canAddVariation,
  onNavigate,
  onStartVariation,
  onContextMenu,
}: MoveButtonProps) {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0 group/move">
      <button
        type="button"
        onClick={() => onNavigate(path)}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(path, e.clientX, e.clientY)
        }}
        className={clsx(
          "text-xs sm:text-sm rounded-lg px-2 py-1 transition inline-flex items-baseline gap-0.5",
          active
            ? "bg-indigo-600 text-white"
            : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600",
        )}
        title={
          canAddVariation
            ? `Go to ply ${ply}. Right-click to add a variation here.`
            : `Go to ply ${ply}`
        }
        aria-label={`${prefix}${node.san}`}
      >
        {prefix && <span className="opacity-60 mr-0.5 font-mono">{prefix}</span>}
        <SanNotation san={node.san} color={colorFromPly(ply, startWhite)} size="inherit" />
      </button>
      {canAddVariation && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onStartVariation(path)
          }}
          className={clsx(
            "text-[10px] font-bold leading-none rounded-md px-1 py-0.5 transition",
            "opacity-0 group-hover/move:opacity-100 focus:opacity-100",
            "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900",
          )}
          title="Add variation from this position"
          aria-label={`Add variation from before ${node.san}`}
        >
          +
        </button>
      )}
    </span>
  )
}

interface LineProps {
  nodes: MoveTreeNode[]
  pathPrefix: MovePath
  ply: number
  numbering: MoveNumbering
  cursorPath: MovePath
  onNavigate: (path: MovePath) => void
  onStartVariation: (parentPath: MovePath) => void
  onContextMenu: (path: MovePath, x: number, y: number) => void
  /** When true, render siblings after index 0 as parenthesized variations. */
  showVariations: boolean
}

function MoveLine({
  nodes,
  pathPrefix,
  ply,
  numbering,
  cursorPath,
  onNavigate,
  onStartVariation,
  onContextMenu,
  showVariations,
}: LineProps) {
  if (nodes.length === 0) return null

  const [main, ...variations] = nodes
  const mainPath = [...pathPrefix, 0]

  return (
    <>
      <MoveButton
        node={main}
        path={mainPath}
        ply={ply}
        prefix={plyPrefix(ply, numbering)}
        active={pathKey(cursorPath) === pathKey(mainPath)}
        startWhite={numbering.startWhite}
        canAddVariation
        onNavigate={onNavigate}
        onStartVariation={(path) => onStartVariation(positionBeforeMove(path))}
        onContextMenu={onContextMenu}
      />
      {showVariations &&
        variations.map((node, i) => (
          <VariationBranch
            key={pathKey([...pathPrefix, i + 1])}
            node={node}
            path={[...pathPrefix, i + 1]}
            ply={ply}
            numbering={numbering}
            cursorPath={cursorPath}
            onNavigate={onNavigate}
            onStartVariation={onStartVariation}
            onContextMenu={onContextMenu}
          />
        ))}
      <MoveLine
        nodes={main.children}
        pathPrefix={mainPath}
        ply={ply + 1}
        numbering={numbering}
        cursorPath={cursorPath}
        onNavigate={onNavigate}
        onStartVariation={onStartVariation}
        onContextMenu={onContextMenu}
        showVariations
      />
    </>
  )
}

interface VariationProps {
  node: MoveTreeNode
  path: MovePath
  ply: number
  numbering: MoveNumbering
  cursorPath: MovePath
  onNavigate: (path: MovePath) => void
  onStartVariation: (parentPath: MovePath) => void
  onContextMenu: (path: MovePath, x: number, y: number) => void
}

function VariationBranch({
  node,
  path,
  ply,
  numbering,
  cursorPath,
  onNavigate,
  onStartVariation,
  onContextMenu,
}: VariationProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50">
      <span className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/80">(</span>
      <MoveButton
        node={node}
        path={path}
        ply={ply}
        prefix={variationPrefix(ply, numbering)}
        active={pathKey(cursorPath) === pathKey(path)}
        startWhite={numbering.startWhite}
        canAddVariation
        onNavigate={onNavigate}
        onStartVariation={(p) => onStartVariation(positionBeforeMove(p))}
        onContextMenu={onContextMenu}
      />
      <VariationContinuation
        nodes={node.children}
        pathPrefix={path}
        ply={ply + 1}
        numbering={numbering}
        cursorPath={cursorPath}
        onNavigate={onNavigate}
        onStartVariation={onStartVariation}
        onContextMenu={onContextMenu}
      />
      <span className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/80">)</span>
    </span>
  )
}

function VariationContinuation({
  nodes,
  pathPrefix,
  ply,
  numbering,
  cursorPath,
  onNavigate,
  onStartVariation,
  onContextMenu,
}: Omit<LineProps, "showVariations">) {
  if (nodes.length === 0) return null

  const [main, ...variations] = nodes
  const mainPath = [...pathPrefix, 0]

  return (
    <>
      <MoveButton
        node={main}
        path={mainPath}
        ply={ply}
        prefix={plyPrefix(ply, numbering)}
        active={pathKey(cursorPath) === pathKey(mainPath)}
        startWhite={numbering.startWhite}
        canAddVariation
        onNavigate={onNavigate}
        onStartVariation={(path) => onStartVariation(positionBeforeMove(path))}
        onContextMenu={onContextMenu}
      />
      {variations.map((node, i) => (
        <VariationBranch
          key={pathKey([...pathPrefix, i + 1])}
          node={node}
          path={[...pathPrefix, i + 1]}
          ply={ply}
          numbering={numbering}
          cursorPath={cursorPath}
          onNavigate={onNavigate}
          onStartVariation={onStartVariation}
          onContextMenu={onContextMenu}
        />
      ))}
      <VariationContinuation
        nodes={main.children}
        pathPrefix={mainPath}
        ply={ply + 1}
        numbering={numbering}
        cursorPath={cursorPath}
        onNavigate={onNavigate}
        onStartVariation={onStartVariation}
        onContextMenu={onContextMenu}
      />
    </>
  )
}

interface ContextMenuState {
  path: MovePath
  x: number
  y: number
}

export function MoveTreeList({
  tree,
  cursorPath,
  numbering,
  onNavigate,
  onStartVariation,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  useEffect(() => {
    if (!contextMenu) return

    function close() {
      setContextMenu(null)
    }

    function onPointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node)) return
      close()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [contextMenu])

  function openContextMenu(path: MovePath, x: number, y: number) {
    setContextMenu({ path, x, y })
  }

  function branchFromContextMenu() {
    if (!contextMenu) return
    onStartVariation(positionBeforeMove(contextMenu.path))
    setContextMenu(null)
  }

  if (tree.children.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-slate-500 italic">
        Make a move on the board to start a line. You control both sides.
      </p>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-1 max-h-[min(38vh,22rem)] overflow-y-auto overscroll-contain pr-1 leading-relaxed [scrollbar-width:thin] [scrollbar-color:theme(colors.gray.300)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
        <MoveLine
          nodes={tree.children}
          pathPrefix={[]}
          ply={0}
          numbering={numbering}
          cursorPath={cursorPath}
          onNavigate={onNavigate}
          onStartVariation={onStartVariation}
          onContextMenu={openContextMenu}
          showVariations
        />
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[11rem] rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={branchFromContextMenu}
            className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
          >
            Add variation here
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onNavigate(contextMenu.path)
              setContextMenu(null)
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition"
          >
            Go to this move
          </button>
        </div>
      )}
    </>
  )
}
