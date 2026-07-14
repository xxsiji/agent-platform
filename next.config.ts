import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 是 ESM-first 包，被 Next.js RSC 打包时会因 ESM/CJS 互操作
  // 触发 "Object.defineProperty called on non-object"。标记为外部依赖，让 Node
  // 在运行时原生加载，避免 webpack 包裹模块导致的崩溃。
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
