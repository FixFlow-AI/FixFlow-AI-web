# GitHub OAuth Setup (Backend)

Email/password authentication stays fully active. GitHub OAuth is added as an extra sign-in option.

## Required environment variables

Set these in `backend/.env`:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL` (default: `http://localhost:5000/api/auth/github/callback`)
- `GITHUB_OAUTH_SCOPE` (default: `read:user user:email`)

## GitHub OAuth App settings

In your GitHub OAuth App, set:

- **Authorization callback URL** = value of `GITHUB_CALLBACK_URL`

## Available endpoints

Base path: `/api/auth`

1. `GET /github/url`
   - Returns `{ authUrl }` to start OAuth from frontend.
   - Optional query: `state`.

2. `GET /github`
   - Redirects directly to GitHub authorization screen.
   - Optional query: `state`.

3. `POST /github/exchange`
   - Exchanges GitHub `code` for app auth tokens.
   - Body:
     ```json
     {
       "code": "github_authorization_code",
       "state": "optional_state"
     }
     ```
   - Returns:
     - `user`
     - `accessToken`
     - `refreshToken`
     - `provider: "github"`

4. `GET /github/callback`
   - Backend callback endpoint for GitHub.
   - Also returns app auth tokens in JSON.

## Notes

- Existing endpoints remain unchanged:
  - `POST /register`
  - `POST /login`
  - `POST /refresh`
  - `GET /me`
  - `POST /logout`
- If a GitHub email matches an existing account, backend links that user to GitHub (`githubId`) automatically.
