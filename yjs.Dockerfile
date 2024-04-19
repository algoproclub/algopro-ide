FROM node:latest

RUN git clone https://github.com/cpinitiative/ide-yjs.git
WORKDIR /ide-yjs
RUN npm install

ENTRYPOINT ["npm", "run", "dev"]