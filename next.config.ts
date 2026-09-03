import type { NextConfig } from 'next';
import createMDX from '@next/mdx';

const nextConfig: NextConfig = {
  reactCompiler: true,
  bundlePagesRouterDependencies: true,
  turbopack: {
    resolveAlias: {
      'react/compiler-runtime': 'react-compiler-runtime',
    },
  },
  async rewrites() {
    if (process.env.NEXT_PUBLIC_PRODUCT_NAME !== 'MATFIN IDE') {
      return {
        beforeFiles: [
          {
            source: '/apple-touch-icon.png',
            destination: '/logo.png',
          },
        ],
        afterFiles: [],
        fallback: [],
      };
    }

    return {
      beforeFiles: [
        {
          source: '/favicon.ico',
          destination: '/favicon-matfin.ico',
        },
        {
          source: '/apple-touch-icon.png',
          destination: '/logo-matfin.png',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default createMDX({})(nextConfig);
