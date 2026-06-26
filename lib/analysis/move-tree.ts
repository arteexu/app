// lib/analysis/move-tree.ts
// Variation tree for free analysis: each node is a played move; siblings are
// alternative lines from the same parent position. Navigation uses a path of
// child indices from the root.

export interface PlayedMove {
  san: string
  from: string
  to: string
  fenAfter: string
}

export interface MoveTreeNode extends PlayedMove {
  children: MoveTreeNode[]
}

export interface MoveTree {
  rootFen: string
  children: MoveTreeNode[]
}

export type MovePath = number[]

export function emptyMoveTree(rootFen: string): MoveTree {
  return { rootFen, children: [] }
}

export function pathKey(path: MovePath): string {
  return path.length === 0 ? "root" : path.join(".")
}

export function pathsEqual(a: MovePath, b: MovePath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function isPathPrefix(prefix: MovePath, full: MovePath): boolean {
  return prefix.length <= full.length && prefix.every((v, i) => v === full[i])
}

/** Node at `path`, or null when `path` is empty (root position). */
export function getNodeAt(tree: MoveTree, path: MovePath): MoveTreeNode | null {
  let nodes = tree.children
  let node: MoveTreeNode | null = null
  for (const idx of path) {
    node = nodes[idx] ?? null
    if (!node) return null
    nodes = node.children
  }
  return node
}

export function getFenAt(tree: MoveTree, path: MovePath): string {
  if (path.length === 0) return tree.rootFen
  const node = getNodeAt(tree, path)
  return node?.fenAfter ?? tree.rootFen
}

export function getLastMoveAt(tree: MoveTree, path: MovePath): PlayedMove | null {
  if (path.length === 0) return null
  const node = getNodeAt(tree, path)
  if (!node) return null
  return { san: node.san, from: node.from, to: node.to, fenAfter: node.fenAfter }
}

export function getChildrenAt(tree: MoveTree, path: MovePath): MoveTreeNode[] {
  if (path.length === 0) return tree.children
  return getNodeAt(tree, path)?.children ?? []
}

export function countPlies(tree: MoveTree): number {
  function walk(nodes: MoveTreeNode[]): number {
    let max = 0
    for (const node of nodes) {
      max = Math.max(max, 1 + walk(node.children))
    }
    return max
  }
  return walk(tree.children)
}

/** Compare SAN strings, ignoring check/mate suffixes. */
export function movesMatch(a: string, b: string): boolean {
  return a.replace(/[+#]/g, "") === b.replace(/[+#]/g, "")
}

function playedMovesMatch(a: PlayedMove, b: PlayedMove): boolean {
  return movesMatch(a.san, b.san) && a.from === b.from && a.to === b.to
}

function findMatchingChildIndex(children: MoveTreeNode[], move: PlayedMove): number | null {
  for (let i = 0; i < children.length; i++) {
    if (playedMovesMatch(children[i], move)) return i
  }
  return null
}

/** Append one or more moves along `path`; returns updated tree and final path. */
export function appendMovesAt(
  tree: MoveTree,
  path: MovePath,
  moves: PlayedMove[],
): { tree: MoveTree; path: MovePath } {
  if (moves.length === 0) return { tree, path }

  let nextTree = tree
  let nextPath = [...path]

  for (const move of moves) {
    const { tree: updated, childIndex } = addChildAt(nextTree, nextPath, move)
    nextTree = updated
    nextPath = [...nextPath, childIndex]
  }

  return { tree: nextTree, path: nextPath }
}

function addChildAt(
  tree: MoveTree,
  path: MovePath,
  move: PlayedMove,
): { tree: MoveTree; childIndex: number } {
  if (path.length === 0) {
    const existingIndex = findMatchingChildIndex(tree.children, move)
    if (existingIndex !== null) {
      return { tree, childIndex: existingIndex }
    }

    const child: MoveTreeNode = { ...move, children: [] }
    const childIndex = tree.children.length
    return {
      tree: { ...tree, children: [...tree.children, child] },
      childIndex,
    }
  }

  const child: MoveTreeNode = { ...move, children: [] }

  const [head, ...tail] = path
  const existing = tree.children[head]
  if (!existing) {
    throw new Error(`Invalid move path: ${path.join(".")}`)
  }
  const { node: updatedNode, childIndex } = addChildAtNode(existing, tail, child)
  const children = [...tree.children]
  children[head] = updatedNode
  return { tree: { ...tree, children }, childIndex }
}

function addChildAtNode(
  node: MoveTreeNode,
  path: MovePath,
  child: MoveTreeNode,
): { node: MoveTreeNode; childIndex: number } {
  if (path.length === 0) {
    const existingIndex = findMatchingChildIndex(node.children, child)
    if (existingIndex !== null) {
      return { node, childIndex: existingIndex }
    }

    const childIndex = node.children.length
    return { node: { ...node, children: [...node.children, child] }, childIndex }
  }

  const [head, ...tail] = path
  const existing = node.children[head]
  if (!existing) {
    throw new Error(`Invalid move path: ${path.join(".")}`)
  }
  const { node: updatedChild, childIndex } = addChildAtNode(existing, tail, child)
  const children = [...node.children]
  children[head] = updatedChild
  return { node: { ...node, children }, childIndex }
}

/** Pick the child index to follow when stepping forward from `path`. */
export function forwardChildIndex(
  tree: MoveTree,
  path: MovePath,
  hintPath: MovePath,
): number | null {
  const children = getChildrenAt(tree, path)
  if (children.length === 0) return null

  if (hintPath.length > path.length && isPathPrefix(path, hintPath)) {
    return hintPath[path.length]
  }

  return 0
}

export function stepForward(
  tree: MoveTree,
  path: MovePath,
  hintPath: MovePath,
): MovePath | null {
  const childIndex = forwardChildIndex(tree, path, hintPath)
  if (childIndex == null) return null
  return [...path, childIndex]
}

export function stepToLineEnd(
  tree: MoveTree,
  path: MovePath,
  hintPath: MovePath,
): MovePath {
  let current = path
  while (true) {
    const next = stepForward(tree, current, hintPath)
    if (!next) break
    current = next
  }
  return current
}

export function parentPath(path: MovePath): MovePath {
  return path.slice(0, -1)
}

/** Position immediately before the move at `path`. */
export function positionBeforeMove(path: MovePath): MovePath {
  return parentPath(path)
}

/** True when playing a different move from `path` creates a sibling variation. */
export function canBranchAt(tree: MoveTree, path: MovePath): boolean {
  return getChildrenAt(tree, path).length > 0
}

export interface MoveNumbering {
  startWhite: boolean
  baseFull: number
}

export function plyPrefix(ply: number, { startWhite, baseFull }: MoveNumbering): string {
  const whiteMove = startWhite ? ply % 2 === 0 : ply % 2 === 1
  const num = startWhite ? baseFull + Math.floor(ply / 2) : baseFull + Math.floor((ply + 1) / 2)
  if (whiteMove) return `${num}.`
  if (ply === 0) return `${num}…`
  return ""
}

export function variationPrefix(ply: number, { startWhite, baseFull }: MoveNumbering): string {
  const whiteMove = startWhite ? ply % 2 === 0 : ply % 2 === 1
  const num = startWhite ? baseFull + Math.floor(ply / 2) : baseFull + Math.floor((ply + 1) / 2)
  if (whiteMove) return `${num}.`
  return `${num}…`
}
