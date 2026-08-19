# FixFlowAI — Freelancer-Only Launch Structure

> **Purpose:** authoritative implementation and rollback guide for the temporary freelancer-only public launch.
>
> **Launch status:** new public accounts can onboard only as freelancers through GitHub. Existing users keep their stored roles and can continue signing in and using their original workspaces.
>
> **Primary rollback mechanism:** two environment flags. No data migration is required.

## 1. Product Policy

### New users
- Freelancer onboarding is open.
- Signup uses GitHub OAuth because verified skills are derived from repositories.
- Every genuinely new GitHub account is forced to the `freelancer` role server-side.
- Client, developer, and agency signup cards remain visible with a designed **Coming Soon** state.
- New Google accounts are rejected with code `freelancer_onboarding_only`.
- Role-changing requests are paused, preventing a new freelancer from self-promoting.

### Existing users
- Existing client, developer, agency, and freelancer accounts can still log in.
- Existing users retain the role already stored in the user repository.
- Google login remains available for returning Google users.
- GitHub login remains available for returning GitHub users.
- A returning user matched by a verified email across OAuth providers retains the old account and role.
- Existing non-freelancer dashboard navigation is unchanged.

### Freelancer dashboard
- **Code Analytics** is the only active product panel.
- Overview, Agreement, Delivery Control, Escrow Funds, Payments, Automations, and Outcomes remain visible but disabled.
- Every disabled item has a compact orange **Coming Soon** badge.
- A direct URL to a disabled freelancer panel redirects to Code Analytics.
- Client-only panels remain hidden from freelancers as before.

## 2. Feature Flags

| Layer | Variable | Launch value | Full-platform value |
|---|---|---:|---:|
| Backend | `FREELANCER_ONLY_ONBOARDING` | `true` | `false` |
| Frontend build | `VITE_FREELANCER_ONLY_ONBOARDING` | `true` | `false` |

Both flags default to enabled when omitted. This is deliberate: a missing production variable must not accidentally reopen unfinished signup paths.
## 3. Implementation Map

### Backend enforcement
**`backend/src/routes/auth.ts`**
- Defines the default-on backend launch flag.
- Google OAuth resolves existing identity by Google subject, then verified email.
- Existing Google users are issued normal sessions with their stored role.
- A genuinely new Google user receives HTTP 403 and `freelancer_onboarding_only`.
- GitHub OAuth resolves existing identity by GitHub ID, then verified email.
- A genuinely new GitHub account is forced to `freelancer`, ignoring a tampered `intendedRole`.
- Existing GitHub/cross-provider users retain their stored role.
- `PATCH /api/auth/me/role` allows a no-op but blocks role mutation while launch mode is enabled.
- `/api/auth/dev-login` returns 404 in production and remains available only for local development.

**`backend/src/services/userRepository.ts`**
- File and DynamoDB repositories link provider identities by email only when the provider reports that email as verified.
- This prevents an unverified GitHub/noreply address from taking over or merging with another account.

### Frontend launch experience
**`frontend/src/config/launchMode.js`**
- Central frontend launch flag.
- Defaults to enabled unless explicitly set to the string `false`.

**`frontend/src/sections/Signup.jsx`**
- Shows Freelancer, Client, Developer, and Agency cards.
- Freelancer is the default and only open signup path.
- Other cards show an orange Coming Soon state and no OAuth control.
- Existing users are directed to Login.
- With the frontend flag disabled, all original role OAuth controls reopen.

**`frontend/src/sections/Login.jsx`**
- Keeps Google and GitHub available for existing users.
- Explains that grandfathered users should use their original provider.
- The developer bypass is absent from production bundles and shown only in Vite development mode.

**`frontend/src/sections/Dashboard.jsx`**
- Adds role-specific Coming Soon metadata.
- For freelancers in launch mode, Code Analytics is the default/only allowed panel.
- Disabled navigation cannot be opened by click or direct URL.
- Other roles see their existing navigation unchanged.

**`frontend/src/index.css`**
- Adds the compact orange sidebar badge and disabled navigation treatment.

**`frontend/src/store/useLandingStore.js`**
- Missing roles now remain `null` instead of silently becoming `client` in browser state.

### Deployment configuration
**`render.yaml`** explicitly defines both flags as `true` for the backend and static frontend build.

**Environment templates:**
- `backend/.env.example`
- `frontend/.env.example`

## 4. Access Matrix

| User situation | Provider | Result |
|---|---|---|
| New freelancer | GitHub | Account created as freelancer; scan onboarding starts |
| New user requesting developer via tampered GitHub payload | GitHub | Account still created as freelancer |
| New client/developer/agency | Google | 403 Coming Soon; no account created |
| Existing client | Original Google | Login succeeds; client role and workspace preserved |
| Existing agency/developer | Original Google | Login succeeds; role and workspace preserved |
| Existing freelancer | GitHub | Login succeeds; manual Re-analyze remains available |
| Existing user using another provider with same verified email | Google/GitHub | Existing account linked; stored role preserved |
| GitHub identity with unverified/noreply email matching another record | GitHub | No email-based merge |
| Any user changing role while launch flag is on | Authenticated PATCH | No-op accepted; actual change rejected with 403 |
| Production caller using dev-login | Dev bypass | 404 |
## 5. Reopening the Full Platform

When client, developer, and agency onboarding plus the freelancer workspace features are ready:

1. In the Render backend service, set:
   ```env
   FREELANCER_ONLY_ONBOARDING=false
   ```
2. In the Render static frontend service, set:
   ```env
   VITE_FREELANCER_ONLY_ONBOARDING=false
   ```
3. Trigger **Clear build cache & deploy** for the frontend because Vite variables are embedded at build time.
4. Redeploy the backend.
5. Update both values to `"false"` in `render.yaml` so the Blueprint remains the source of truth.
6. Verify the matrix below before announcing availability.

### Full-platform rollback acceptance checks
- Signup defaults to Client and all role cards expose their intended OAuth controls.
- New Google client/developer/agency signup succeeds.
- New GitHub freelancer/developer signup follows the normal provider role matrix.
- `PATCH /api/auth/me/role` can change to all valid roles again.
- Freelancer Overview, Agreement, Delivery Control, Escrow, Payments, Automations, and Outcomes open normally.
- Direct dashboard hashes remain role-gated but are no longer Coming Soon for freelancers.
- Existing account roles and data are unchanged.

No source-code revert should be necessary. The code intentionally contains both launch and full-platform branches.

## 6. Deployment Checklist

1. Push the backend, frontend, `render.yaml`, and this document together.
2. Confirm Render syncs the two flags as `true`.
3. Deploy backend first, then frontend.
4. Open a private/incognito browser session.
5. Verify Client/Developer/Agency cards show Coming Soon and cannot create an account.
6. Create a new GitHub account session and confirm returned role is `freelancer`.
7. Confirm first-time scan onboarding appears.
8. Confirm the freelancer sidebar opens Code Analytics only.
9. Confirm disabled items display Coming Soon and direct hashes redirect to `/analytics`.
10. Log in with one grandfathered Google client/agency/developer account and verify its stored role and workspace.
11. Confirm production `/api/auth/dev-login` returns 404.

## 7. Security and Data Guarantees

- The frontend Coming Soon state is presentation only; the backend is authoritative.
- Client-provided `intendedRole` is never trusted for new accounts during launch mode.
- Existing role preservation happens before session/JWT issuance.
- Provider linking requires a verified email when provider IDs differ.
- GitHub access tokens remain server-side and are never included in public user responses.
- No existing user rows are rewritten by enabling or disabling launch mode.
- No database migration or role backfill is part of this rollout.

## 8. Files Changed

- `backend/src/routes/auth.ts`
- `backend/src/services/userRepository.ts`
- `backend/.env.example`
- `frontend/src/config/launchMode.js`
- `frontend/src/sections/Signup.jsx`
- `frontend/src/sections/Login.jsx`
- `frontend/src/sections/Dashboard.jsx`
- `frontend/src/store/useLandingStore.js`
- `frontend/src/index.css`
- `frontend/.env.example`
- `render.yaml`
- `FREELANCER_ONLY_LAUNCH_STRUCTURE.md`

## 9. Validation Commands

```text
backend:  npm run typecheck
backend:  npm run build
backend:  npm test
frontend: npm run typecheck
frontend: npm run build
```

The frontend currently emits a Vite chunk-size warning for the existing ~700 KB bundle; it is not a build failure and is unrelated to this rollout.

## 10. Validation Result for This Implementation

Completed successfully on the implementation workspace:

- Backend TypeScript typecheck: passed.
- Backend TypeScript production build: passed.
- Backend subsystem verification suite: passed all checks.
- Frontend JavaScript/TypeScript typecheck: passed.
- Frontend Vite production build: passed.
- Changed-file diagnostics: no errors or warnings.
- `git diff --check`: passed (no whitespace errors).

Deployment is not performed by this document. After deployment, complete the browser acceptance checks in Section 6 with both a fresh GitHub identity and at least one grandfathered non-freelancer account.

> If the frontend is deployed through AWS Amplify instead of Render Static Sites, set `VITE_FREELANCER_ONLY_ONBOARDING` in Amplify's branch environment variables too. Its default remains safe (`true`), but reopening the full platform requires an explicit `false` and a new frontend build.
