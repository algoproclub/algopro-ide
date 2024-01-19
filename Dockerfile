FROM node:slim
WORKDIR /app

COPY package*.json ./
RUN yarn install
COPY index.html ./
COPY *.js ./
COPY *.ts ./


EXPOSE 3000
ENTRYPOINT ["yarn", "dev"]