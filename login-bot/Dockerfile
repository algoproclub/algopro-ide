FROM mcr.microsoft.com/playwright:v1.42.1-jammy
WORKDIR /app/login-bot

COPY package.json ./
COPY yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./
RUN yarn build

EXPOSE 3100
ENTRYPOINT ["yarn", "start"]
