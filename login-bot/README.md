## Endpoints

- `GET /`: healthcheck
- `POST /login`:
  - request: `{ platform: "codeforces", username, password }`
  - response: `{ username, cookie, csrf_token }`
- `POST /login`:
  - request: `{ platform: "spoj", username, password }`
  - response: `{ username, cookie }`
