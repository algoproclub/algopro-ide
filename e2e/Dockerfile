FROM mcr.microsoft.com/playwright:v1.42.1-jammy
WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
RUN yarn install --frozen-lockfile

COPY *.ts ./

ENTRYPOINT ["yarn", "playwright", "test"]
