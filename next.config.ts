import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM-heavy packages are loaded from node_modules at runtime instead of being bundled.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp", "pg", "unpdf"],
  turbopack: { root: import.meta.dirname },
  agentRules: false,
  devIndicators: false,
};

export default nextConfig;
