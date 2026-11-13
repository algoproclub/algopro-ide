import type { NextConfig } from 'next';
import createMDX from '@next/mdx';

const nextConfig: NextConfig = {
  reactCompiler: true,
  bundlePagesRouterDependencies: true,
  // The editor is client-only, and vscode-languageclient only exports its
  // browser entry under the `browser` condition, which SSR does not resolve.
  serverExternalPackages: ['monaco-languageclient'],
  turbopack: {
    rules: {
      '*.css': {
        // Monaco registers these styles itself, including in shadow roots.
        condition: {
          path: /node_modules\/(?:@codingame\/monaco-vscode[^/]*|monaco-editor|vscode)\//,
        },
        loaders: [
          {
            loader: './tools/monaco-css-loader.cjs',
            options: {
              modules: false,
              exportType: 'string',
              esModule: true,
            },
          },
        ],
        as: '*.js',
      },
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
            {
              source: '/.well-known/:route',
              destination: '/api/well-known/:route',
            },
          ]
        : [
            {
              source: '/apple-touch-icon.png',
              destination: '/logo.png',
            },
            {
              source: '/.well-known/:route',
              destination: '/api/well-known/:route',
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
