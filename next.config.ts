import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent repo has its own package-lock.json; without this, Turbopack picks
  // BrilliantClone/ as root and breaks module resolution (e.g. @swc/helpers).
  turbopack: {
    root: appRoot,
  },
  // Run the Stockfish WASM engine in the Node server route without bundling it
  // (it loads its own .wasm via fs at runtime). Keeps it external + server-only.
  serverExternalPackages: ["stockfish"],
};

export default nextConfig;
