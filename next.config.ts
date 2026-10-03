import type { NextConfig } from 'next';
import createMDX from '@next/mdx';

const nextConfig: NextConfig = {
  reactCompiler: true,
  bundlePagesRouterDependencies: true,
  // The editor is client-only, and vscode-languageclient only exports its
  // browser entry under the `browser` condition, which SSR does not resolve.
  serverExternalPackages: ['monaco-languageclient'],
  turbopack: {
    resolveAlias: {
      'react/compiler-runtime': 'react-compiler-runtime',
    },
  },
  async rewrites() {
    const groupEditorRewrites = [
      {
        source: '/groups/:group/classes',
        destination: '/groups?group=:group&view=classes',
      },
      {
        source: '/groups/:group',
        destination: '/groups?group=:group&view=members',
      },
    ];
    const beforeFiles =
      process.env.NEXT_PUBLIC_PRODUCT_NAME === 'MATFIN IDE'
        ? [
            {
              source: '/favicon.ico',
              destination: '/favicon-matfin.ico',
            },
            {
              source: '/apple-touch-icon.png',
              destination: '/logo-matfin.png',
            },
          ]
        : [
            {
              source: '/apple-touch-icon.png',
              destination: '/logo.png',
            },
          ];
    return {
      beforeFiles,
      afterFiles: groupEditorRewrites,
      fallback: [],
    };
  },
};

export default createMDX({})(nextConfig);
