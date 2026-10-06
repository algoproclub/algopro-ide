# AGENTS.md

This file applies to the entire repository. More specific AGENTS.md files may override it within individual services.

Treat this as a living document. When a task reveals a durable, non-obvious project convention, or something that contradicts these instructions, mention a focused documentation update to the developer. Do not add temporary branch details or one-off failures.

Read README.md for local development setup, environment variables, and architecture details.

## Building and running

_This expands on the README.md instructions for local development._

The web front-end will be available at http://localhost:3000 and should be used for interaction checks (do not run `next dev` manually!). The instance should be pre-populated with a few users and groups, so the login button should work. If there are no users, prompt the developer to run `tools/setup_local_data.py` to initialize the baseline database.

The web front-end uses Yarn v1 for dependency management. Dependencies are installed in the `web` Docker image at build time but should also be installed locally for pre-commit linting and build checks. Other services use npm.

Every commit must pass the following checks (which are also installable as Husky pre-commit hooks):

- `yarn lint:ci` (ESLint, including Prettier checks)
- `yarn build` (Next.js build)

The regular `yarn lint` command is also available and auto-fixes linting issues.

The Next.js build requires at least:

- `NEXT_PUBLIC_BASE_URL=http://localhost:3000`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL=http://127.0.0.1:9000/?ns=algopro-app-default-rtdb`

To check specific components:

- targeted ESLint
- `yarn tsc --noEmit`

There is no automated test suite. For user-visible changes, interact with the running front-end when browser tooling is available. If interaction is unavailable or blocked, provide precise manual verification steps.

## Technology stack

- Next.js 16 with Pages Router
- React 18 with Jotai for state management
- Firebase for authentication, data storage, and serverless functions
- Hocuspocus/Yjs for real-time collaboration
- [Monaco editor with VSCode extensions](https://github.com/typefox/monaco-languageclient) on desktop and CodeMirror 6 on mobile for code editing
- LSP language services through a remote WebSocket service, or in the browser through BasedPyright (Python) and [clangd-wasm](https://github.com/algoproclub/clangd-wasm) (C++)

Do NOT attempt to migrate Pages Router code to the App Router unless explicitly instructed.

## Change discipline

- Keep changes narrowly scoped. Do not mix data-layer, styling, and unrelated cleanup unless the task requires all three.
- Do not introduce a named type, hook, wrapper, or helper used once unless it clarifies a genuinely complex operation. Put helpers in separate files only when they are used from multiple places or are expected to be reused; otherwise, keep them in the file that uses them.
- Add explicit types only where it helps legibility: structural types and deduction can be used when scoped to a single function.
- Do not clean up pre-existing warnings or types unless they overlap the task.
- Identify adjacent refactoring opportunities separately; do not expand the current change without approval.
- When introducing a large refactor, offer to split it into multiple commits or even stacked branches/PRs. For each change, determine which commit in the sequence should own it.
- Prefer to extend/fix existing helpers and abstractions instead of introducing new, similarly aimed ones.
- For substantial functionality that would otherwise require custom infrastructure or significant code, consider whether a well-maintained dependency or upgrade materially simplifies the implementation. Compare reasonable alternatives, but do not add or upgrade dependencies without explicit approval.
- Treat review comments as hypotheses to verify rather than instructions to apply mechanically.
- Prefer abstractions that make their call sites easier to understand.
- Preserve unrelated tracked and untracked work. Scope staging and stashes explicitly.

## Coding conventions

- The React Compiler is enabled. Avoid defensive `useMemo`/`useCallback` unless identity stability is required by an effect, subscription, or child API.
- When using a library or API, prefer to use it in a way that is idiomatic to that library, referencing documentation before exploring source code.
- Prefer stable IDs over array indices for selection, keys, and data lookup.
- Always clean up subscriptions, timers, animation frames, and Firebase listeners.
- Prefer plain React state and effects, but use existing Jotai atoms and offer to add new ones when they would be shared across multiple components and improve readability.
- When a component/control is used in multiple places or has complex state, consider making it a reusable component with a clear API. Avoid duplicating logic across components.
- When touched code reveals unclear state ownership or a monolithic component, note the possible refactor separately. Include it only when necessary for the requested change.
- Do not introduce wrappers solely to silence React or ESLint warnings when they reduce clarity without improving correctness.
- Preserve distinct loading, empty, and error states. Avoid remounting stable layout or table shells while their data changes.
- Language server backends implement `LspConnection` in `src/components/editor/lsp/` and must work with both the Monaco and the CodeMirror client. Keep editor-specific behavior in the editor adapters.

## UI conventions

- The user interface uses English throughout, but make sure to use standard technical terminology alongside easy-to-understand prose.
- The app targets desktop users, so keyboard navigation, shortcuts, and hover states are crucial. Interfaces should be dense and provide useful context without excessive navigation while remaining functional on mobile.
- Use the existing semantic `theme-*` tokens instead of hardcoded light/dark colors. If the token set cannot express sufficient contrast or a state correctly, prefer correct behavior and propose improving the token set.
- Preserve clear hover, active, selected, disabled, and focus-visible states.
- Use Heroicons where the surrounding UI already uses Heroicons or when a new component is introduced.
- Match existing components and conventions before inventing a new visual pattern.
- Do not add redundant ARIA attributes to already-semantic controls, but preserve or improve existing accessibility semantics when touching a component.

## Firebase usage

- Be conscious of Firebase costs (database reads/writes and function invocations). Avoid unnecessary reads/writes and batch them when possible. Avoid using Firebase functions for trivial tasks that can be done on the client side.
- Reuse already-fetched documents. Do not fetch a collection and then immediately re-fetch one of its documents when the first result contains the required data.
- Do not assume that the developer has access to the production database. Only offer to inspect it when explicitly asked or when database schema cannot be inferred from existing usage or documentation. If there are questions, ask for clarification instead of making assumptions.
- Treat the following as design-capacity assumptions rather than current collection counts:
  - Number of schools: 100
  - Number of groups per school: 20
  - Number of users per group: 20
  - Number of classes per group: 25
  - Number of assignments per class: 10
  - Number of existing documents per student: 200
  - Total number of available problems: 2000
- Prefer bounded queries over downloading collections and filtering locally.
- Prefer RTDB listeners for genuinely live data. Do not poll unchanged status trees. Do not subscribe to a broader RTDB subtree merely to select a small subset.
- Guidelines for security rules:
  - Unauthenticated and unregistered users should not be able to read or write any data.
  - Admins must be able to access at least all data that students or teachers can access.
  - Teachers must be able to access data belonging to all students who share a school with them.
  - School and class task metadata may be readable by all authenticated, registered users when stricter filtering would prevent viable queries.
- Offer to add denormalized projections or change the database schema when doing so would make a feature more efficient or easier to implement. Always ask for approval. Assume the database follows the latest schema. If a backwards-incompatible change is required, add a migration script to `tools/`.
- Note that:
  - Returning `undefined` from an RTDB transaction callback aborts it. Returning the current value may still perform a validated write.
  - `.read` and `.write` grants cascade to descendants; a child rule cannot revoke a parent grant.
  - Firestore security rules are query constraints, not post-query filters. Queries must satisfy the applicable rules themselves.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
