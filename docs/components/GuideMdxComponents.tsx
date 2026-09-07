import type { ComponentPropsWithoutRef } from 'react';
import type { MDXComponents } from 'mdx/types';

const headingClasses = 'scroll-mt-20 font-semibold leading-tight text-content';

export const guideMdxComponents = {
  h1: ({ className, ...props }: ComponentPropsWithoutRef<'h1'>) => (
    <h1
      className={`${headingClasses} mb-5 mt-12 border-b-[3px] border-accent pb-2 text-3xl ${className ?? ''}`}
      {...props}
    />
  ),
  h2: ({ className, ...props }: ComponentPropsWithoutRef<'h2'>) => (
    <h2
      className={`${headingClasses} mb-4 mt-11 text-2xl text-accent-hover ${className ?? ''}`}
      {...props}
    />
  ),
  h3: ({ className, ...props }: ComponentPropsWithoutRef<'h3'>) => (
    <h3
      className={`${headingClasses} mb-3 mt-8 text-xl ${className ?? ''}`}
      {...props}
    />
  ),
  h4: ({ className, ...props }: ComponentPropsWithoutRef<'h4'>) => (
    <h4
      className={`${headingClasses} mb-2 mt-6 text-lg ${className ?? ''}`}
      {...props}
    />
  ),
  p: ({ className, ...props }: ComponentPropsWithoutRef<'p'>) => (
    <p
      className={`my-3 text-justify leading-7 text-content-secondary [text-wrap:pretty] ${className ?? ''}`}
      {...props}
    />
  ),
  a: ({ className, ...props }: ComponentPropsWithoutRef<'a'>) => (
    <a
      className={`text-accent-hover underline decoration-accent underline-offset-2 hover:text-accent-strong ${className ?? ''}`}
      {...props}
    />
  ),
  strong: ({ className, ...props }: ComponentPropsWithoutRef<'strong'>) => (
    <strong
      className={`font-semibold text-content ${className ?? ''}`}
      {...props}
    />
  ),
  code: ({ className, ...props }: ComponentPropsWithoutRef<'code'>) => (
    <code
      className={`rounded border border-line bg-surface-muted px-1 py-0.5 text-[0.9em] text-content ${className ?? ''}`}
      {...props}
    />
  ),
  blockquote: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      className={`my-4 rounded-lg border border-line border-l-4 border-l-accent bg-surface-muted px-4 py-3 text-content-secondary [&>p]:m-0 ${className ?? ''}`}
      {...props}
    />
  ),
  ul: ({ className, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul
      className={`my-3 list-disc space-y-1 pl-6 text-content-secondary ${className ?? ''}`}
      {...props}
    />
  ),
  ol: ({ className, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol
      className={`my-3 list-decimal space-y-1 pl-6 text-content-secondary ${className ?? ''}`}
      {...props}
    />
  ),
  li: ({ className, ...props }: ComponentPropsWithoutRef<'li'>) => (
    <li className={`pl-1 ${className ?? ''}`} {...props} />
  ),
  hr: ({ className, ...props }: ComponentPropsWithoutRef<'hr'>) => (
    <hr className={`my-12 border-line ${className ?? ''}`} {...props} />
  ),
} satisfies MDXComponents;
