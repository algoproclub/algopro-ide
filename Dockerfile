FROM node:22-trixie-slim
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install

EXPOSE 3000
CMD ["yarn", "dev"]
