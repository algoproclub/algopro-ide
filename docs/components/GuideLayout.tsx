import type { ReactNode } from 'react';

export function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <main className="online-ide-guide mx-auto w-[calc(100%-2rem)] max-w-6xl pb-20 pt-8">
      {children}
    </main>
  );
}
