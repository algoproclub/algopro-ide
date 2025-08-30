FROM node:latest

COPY yjs /ide-yjs
WORKDIR /ide-yjs
RUN npm install

ENTRYPOINT ["npm", "run", "dev"]