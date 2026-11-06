FROM node:22-trixie-slim

ENV PNPM_HOME=/pnpm

RUN corepack enable pnpm

WORKDIR /app/functions

COPY functions/package.json functions/pnpm-lock.yaml functions/pnpm-workspace.yaml ./

RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile

ENTRYPOINT ["pnpm", "run", "build:watch", "--preserveWatchOutput"]
