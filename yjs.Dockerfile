FROM node:22-trixie-slim

WORKDIR /app/yjs

COPY yjs ./

RUN --mount=type=cache,target=/root/.npm npm install

ENTRYPOINT ["npm", "run", "dev"]
