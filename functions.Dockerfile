FROM node:22-trixie-slim

WORKDIR /app/functions

ENTRYPOINT npm install && npm run build:watch -- --preserveWatchOutput
