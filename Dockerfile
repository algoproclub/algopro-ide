FROM node:22-trixie-slim
WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn yarn install --frozen-lockfile


EXPOSE 3000
ENTRYPOINT ["yarn", "dev"]
