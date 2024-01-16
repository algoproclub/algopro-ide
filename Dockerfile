FROM node:slim
WORKDIR /app

COPY package*.json ./
RUN yarn install

EXPOSE 3000
ENTRYPOINT ["yarn", "dev"]