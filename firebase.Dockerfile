FROM node:22-trixie-slim
RUN apt-get update
RUN apt-get -y install default-jre-headless

WORKDIR /app

RUN npm install -g firebase-tools

RUN firebase setup:emulators:database
RUN firebase setup:emulators:firestore
RUN firebase setup:emulators:storage
RUN firebase setup:emulators:ui

ENTRYPOINT ["firebase", "-P", "algopro-app", "emulators:exec", "--ui", "touch started && sleep infinity"]
HEALTHCHECK CMD test -f started
