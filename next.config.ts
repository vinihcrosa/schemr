import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@excalidraw/excalidraw"],
  // Keep the headless-conversion stack as external node modules so Next does
  // NOT bundle/eagerly-evaluate them. They must load lazily (via dynamic
  // import in lib/spec-to-excalidraw.ts) AFTER the jsdom DOM shim installs a
  // global `window`; otherwise mermaid's bundled DOMPurify initializes without
  // a window (`addHook is not a function`).
  serverExternalPackages: [
    "jsdom",
    "mermaid",
    "@excalidraw/mermaid-to-excalidraw",
  ],
};

export default nextConfig;
