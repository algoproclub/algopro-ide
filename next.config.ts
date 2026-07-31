import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  bundlePagesRouterDependencies: true,
  turbopack: {
    resolveAlias: {
      'react/compiler-runtime': 'react-compiler-runtime',
    },
  },
};

export default nextConfig;
