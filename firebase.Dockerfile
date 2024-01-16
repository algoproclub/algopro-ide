FROM node:slim
RUN apt-get update
RUN apt-get -y install default-jre

WORKDIR /app

RUN npm install -g firebase-tools

COPY firebase.json ./
COPY database.rules.json ./
ENTRYPOINT ["firebase", "emulators:start", "-P", "planets-prog"]