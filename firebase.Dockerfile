FROM node:22-trixie-slim

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends default-jre-headless

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm \
    npm install -g firebase-tools

RUN --mount=type=cache,target=/root/.cache/firebase,sharing=locked \
    firebase setup:emulators:database && \
    firebase setup:emulators:firestore && \
    firebase setup:emulators:storage && \
    firebase setup:emulators:ui

RUN mkdir -p /data/firebase-emulator/data

COPY <<-"EOF" /app/start-emulators.sh
#!/bin/sh
set -e

EMULATOR_DATA_DIR="/data/firebase-emulator/data"

IMPORT_ARGS=""
if [ -d "$EMULATOR_DATA_DIR" ] && [ -n "$(ls -A "$EMULATOR_DATA_DIR")" ]; then
    echo "Importing existing emulator data from $EMULATOR_DATA_DIR"
    IMPORT_ARGS="--import=$EMULATOR_DATA_DIR"
fi

exec firebase -P algopro-app emulators:exec --ui $IMPORT_ARGS --export-on-exit=$EMULATOR_DATA_DIR "touch /app/started && sleep infinity"
EOF

RUN chmod +x /app/start-emulators.sh

ENTRYPOINT ["/app/start-emulators.sh"]
HEALTHCHECK CMD test -f /app/started
