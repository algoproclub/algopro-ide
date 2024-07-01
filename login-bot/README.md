## Endpoints

- `GET /`: healthcheck
- `POST /login`:
  - request: `{ platform: "codeforces", username, password }`
  - response: `{ username, cookie, csrf_token, useragent }`
- `POST /login`:
  - request: `{ platform: "spoj", username, password }`
  - response: `{ username, cookie }`

## Deploy

You will need ssh permission to the EC2 instance. Create a docker context for the instance:
```sh
docker context create aws-ide-login-bot --docker 'host=ssh://ubuntu@192.0.2.1' # replace with ip of EC2 instance
docker context use aws-ide-login-bot
```
Then, you can run the service normally using docker compose, and verify that it started:
```sh
cd login-bot
docker compose up -d
docker ps
```
Switch back to the default context for local testing:
```sh
docker context use default
```
