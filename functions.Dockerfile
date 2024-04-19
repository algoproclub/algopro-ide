FROM node:slim

WORKDIR /app/functions

ENTRYPOINT npm install && npm run build:watch -- --preserveWatchOutput
