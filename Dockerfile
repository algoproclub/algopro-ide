FROM node:22-trixie-slim
WORKDIR /app

COPY package*.json ./
COPY yarn.lock ./
RUN yarn install
COPY tsconfig.json ./
COPY index.html ./
COPY *.js ./
COPY *.ts ./


EXPOSE 3000
ENTRYPOINT ["yarn", "dev"]
