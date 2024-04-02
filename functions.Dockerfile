FROM node:slim

WORKDIR /app/functions

ENTRYPOINT ["npm", "run", "build:watch", "--", "--preserveWatchOutput"]
