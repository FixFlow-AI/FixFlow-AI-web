# Proplytics Environment URLs and Auth Endpoints

This file is the single source of truth for the URLs and callback endpoints you should use for Proplytics in local development and on AWS.

## Active deployed URLs

Use these values for the current hosted environment:

| Purpose | Value |
| --- | --- |
| Testing frontend | `https://testing.d22glq95zibf1w.amplifyapp.com` |
| Main frontend | `https://main.d22glq95zibf1w.amplifyapp.com` |
| Shared backend API base | `https://d6opkcrsagj0v.cloudfront.net/api` |
| Backend health check | `https://d6opkcrsagj0v.cloudfront.net/api/health` |
| GitHub OAuth callback | `https://d6opkcrsagj0v.cloudfront.net/api/auth/github/callback` |

## Local development URLs

Use these values when you run the app locally:

| Purpose | Value |
| --- | --- |
| Local frontend | `http://localhost:3001` |
| Local backend API base | `http://localhost:5000/api` |
| Local backend health check | `http://localhost:5000/api/health` |
| Local GitHub OAuth callback when using local backend | `http://localhost:5000/api/auth/github/callback` |

## Frontend environment values

### Local frontend `.env`

```env
VITE_API_URL=http://localhost:5000/api
```

### Testing Amplify branch

```env
VITE_API_URL=https://d6opkcrsagj0v.cloudfront.net/api
```

### Main Amplify branch

```env
VITE_API_URL=https://d6opkcrsagj0v.cloudfront.net/api
```

## Backend environment values

### Local backend `backend/.env`

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
```

### Hosted backend defaults

When you deploy with `scripts/deploy-testing.ps1` or `scripts/deploy-aws.ps1`, the script now syncs these values into AWS SSM and ECS:

```env
FRONTEND_URL=https://testing.d22glq95zibf1w.amplifyapp.com
GITHUB_CALLBACK_URL=https://d6opkcrsagj0v.cloudfront.net/api/auth/github/callback
```

For `main`, the same backend callback is used, but the default frontend URL should be:

```env
FRONTEND_URL=https://main.d22glq95zibf1w.amplifyapp.com
```

## GitHub OAuth app settings

Use this in your GitHub OAuth App:

| Setting | Value |
| --- | --- |
| Authorization callback URL | `https://d6opkcrsagj0v.cloudfront.net/api/auth/github/callback` |

## Important note about GitHub login across local, testing, and main

Proplytics now carries the active frontend origin through the OAuth `state` payload. That means:

- You can start GitHub login from `http://localhost:3001`, `https://testing.d22glq95zibf1w.amplifyapp.com`, or `https://main.d22glq95zibf1w.amplifyapp.com`.
- GitHub still redirects back to the single backend callback URL: `https://d6opkcrsagj0v.cloudfront.net/api/auth/github/callback`.
- The backend then safely redirects the browser back to the correct frontend origin after sign-in.

This removes the old problem where one hardcoded `FRONTEND_URL` could send GitHub users to the wrong frontend.

## Auth endpoints

All auth routes are under the backend API base:

```text
https://d6opkcrsagj0v.cloudfront.net/api/auth
```

Main endpoints:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/auth/register` | `POST` | Email/password sign-up |
| `/auth/login` | `POST` | Email/password sign-in |
| `/auth/refresh` | `POST` | Rotate access and refresh tokens |
| `/auth/me` | `GET` | Load current user profile |
| `/auth/me` | `PATCH` | Update profile and notification preferences |
| `/auth/logout` | `POST` | Sign out and revoke refresh token |
| `/auth/github/url` | `GET` | Start GitHub OAuth |
| `/auth/github/callback` | `GET` | GitHub callback handler |
| `/auth/forgot-password/request` | `POST` | Send OTP email |
| `/auth/forgot-password/verify` | `POST` | Reset password with OTP |

## Other links affected by `FRONTEND_URL`

These backend-generated links use `FRONTEND_URL` as their default base:

- public proposal portal links
- workspace invite email links
- portal feedback email links

If you want those links to point at the testing site, deploy the testing branch so `FRONTEND_URL` is synchronized to the testing URL. If you want them to point at main, deploy main.
