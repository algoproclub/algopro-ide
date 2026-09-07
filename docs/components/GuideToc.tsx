import type { ReactNode } from 'react';

export function GuideToc({ children }: { children: ReactNode }) {
  return (
    <nav
      className="guide-toc mb-10 mt-4 rounded-lg border border-line bg-panel px-5 py-4 shadow-sm [&_li]:my-1 [&_ul]:my-0"
      aria-label="Tartalomjegyzék"
    >
      {children}
    </nav>
  );
}
