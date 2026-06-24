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
};

export default nextConfig;
