FROM node:22-trixie-slim
WORKDIR /app

# AI "Debug" feature: the /api/debug route shells out to the `claude` CLI
# (Claude Code) to locate buggy lines. Installed globally here; authenticated at
# runtime via the CLAUDE_CODE_OAUTH_TOKEN env var (see docker-compose.yml).
# Kept as its own early layer so it is cached independently of app deps.
RUN npm install -g @anthropic-ai/claude-code

# poppler-utils provides `pdftotext`, used by /api/debug to read PDF-only problem
# statements (njudge, oj.uz) so the AI gets the real problem text, not just the title.
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY yarn.lock ./
RUN yarn install
COPY tsconfig.json ./
COPY index.html ./
COPY *.js ./
COPY *.ts ./


EXPOSE 3000
ENTRYPOINT ["yarn", "dev"]
