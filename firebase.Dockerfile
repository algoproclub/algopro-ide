FROM node:slim
RUN apt-get update
RUN apt-get -y install default-jre

WORKDIR /app

RUN npm install -g firebase-tools

COPY .firebaserc ./
COPY firebase.json ./
COPY database.rules.json ./
ENTRYPOINT ["firebase", "-P", "algopro-app", "emulators:exec", "touch started && sleep infinity"]
HEALTHCHECK CMD test -f started
