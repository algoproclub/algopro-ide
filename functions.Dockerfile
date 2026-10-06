FROM node:22-trixie-slim

WORKDIR /app/functions

COPY functions/package*.json ./

RUN --mount=type=cache,target=/root/.npm npm install

ENTRYPOINT ["npm", "run", "build:watch", "--", "--preserveWatchOutput"]
