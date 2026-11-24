FROM node:22-trixie-slim

ENV PNPM_HOME=/pnpm

RUN corepack enable pnpm
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

EXPOSE 3000
CMD ["pnpm", "run", "dev"]
