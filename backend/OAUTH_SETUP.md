# OAuth Setup (Backend)

Email/password authentication stays active for Client and Developer roles. Freelancer authentication must use GitHub.

## Required environment variables

Set these in `backend/.env`:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL` (default: `http://localhost:5000/api/auth/github/callback`)
- `GITHUB_OAUTH_SCOPE` (default: `read:user user:email`)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (default: `http://localhost:5000/api/auth/google/callback`)
- `GOOGLE_OAUTH_SCOPE` (default: `openid email profile`)

## GitHub OAuth App settings

In your GitHub OAuth App, set:

- **Authorization callback URL** = value of `GITHUB_CALLBACK_URL`

For the current hosted environment, that value should be:

- `https://d6opkcrsagj0v.cloudfront.net/api/auth/github/callback`

## Multi-environment behavior

The backend callback stays fixed on the backend domain, while the frontend origin is carried through OAuth `state`.

That means one GitHub OAuth callback can safely serve:

- local frontend: `http://localhost:3001`
- testing frontend: `https://testing.d22glq95zibf1w.amplifyapp.com`
- main frontend: `https://main.d22glq95zibf1w.amplifyapp.com`

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
   - Redirects to the frontend with app auth tokens.

5. `GET /google/url`
   - Returns `{ authUrl }` to start Google OAuth from frontend.
   - Optional query: `state`.

6. `POST /google/exchange`
   - Exchanges Google `code` for app auth tokens.
   - Body shape matches `/github/exchange`.

7. `GET /google/callback`
   - Backend callback endpoint for Google.
   - Redirects to the frontend with app auth tokens.

## Notes

- Email/password endpoints now require role metadata:
  - `POST /register`
  - `POST /login`
- `POST /refresh`
- `GET /me`
- `POST /logout`
- If a GitHub or Google email matches an existing account with the same selected role, backend links that user to the provider automatically.
