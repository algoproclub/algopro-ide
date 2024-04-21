## Endpoints

- `GET /`: healthcheck
- `POST /login/codeforces`:
    - request: `{ username, password }`
    - response: `{ username, session, csrf_token }`
