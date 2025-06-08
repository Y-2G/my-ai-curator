import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React 19のuseOptimistic SSRエラーを回避
  experimental: {
    reactCompiler: false,
  },
  // Server external packages
  serverExternalPackages: [],
  // SSRエラーの回避
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
    }
    return config;
  },
  // ページ設定
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Output設定
  output: 'standalone',
  // 静的生成の設定
  trailingSlash: false,
};

export default nextConfig;
