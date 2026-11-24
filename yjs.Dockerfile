FROM node:22-trixie-slim

ENV PNPM_HOME=/pnpm

RUN corepack enable pnpm

WORKDIR /app/yjs

COPY yjs ./

RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile

ENTRYPOINT ["pnpm", "run", "dev"]
