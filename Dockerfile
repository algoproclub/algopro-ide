FROM node:22-trixie-slim
WORKDIR /app

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
