FROM node:22-trixie-slim
WORKDIR /app

# (PDF-only problem statements are parsed in-process by `pdf-parse`; no
# system packages needed — the earlier poppler-utils/pdftotext layer is gone.)

COPY package*.json ./
COPY yarn.lock ./
RUN yarn install
COPY tsconfig.json ./
COPY index.html ./
COPY *.js ./
COPY *.ts ./
# Prettier config so in-container `eslint` matches CI (plugin:prettier reads it
# relative to the linted file; without it prettier's defaults contradict ours).
COPY .prettierrc .prettierignore ./


EXPOSE 3000
ENTRYPOINT ["yarn", "dev"]
