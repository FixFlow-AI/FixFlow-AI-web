/**
 * GitHub OAuth (authorization-code flow).
 *
 * Unlike Google (which gives us an ID token the browser already holds), GitHub
 * requires a server-side code→token exchange because we need an access token to
 * read the user's repositories during freelancer onboarding.
 *
 * Flow:
 *   1. Frontend redirects the user to GitHub's authorize URL (client_id + scope + state).
 *   2. GitHub redirects back with ?code=...  The frontend POSTs that code here.
 *   3. We exchange the code for an access token, then fetch the GitHub profile.
 *
 * The access token is returned to the caller (route) so a scan can be enqueued,
 * but it must NEVER be sent back to the browser. Request the minimum scopes.
 */

export interface GithubVerifiedProfile {
  githubUserId: string;   // stable numeric id, as string
  githubUsername: string; // login/handle
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  accessToken: string;    // server-only; use for the scan, then discard
}

function getClientId(): string {
  const id = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  if (!id) {
    console.error(
      '[GitHubOAuth] ❌ GITHUB_OAUTH_CLIENT_ID is missing from env vars.',
      'Create an OAuth App at https://github.com/settings/developers and set the client ID in backend/.env',
    );
    throw new Error(
      'GITHUB_OAUTH_CLIENT_ID is not configured. Create an OAuth App at https://github.com/settings/developers.',
    );
  }
  console.log('[GitHubOAuth] ✅ GITHUB_OAUTH_CLIENT_ID loaded (starts with:', id.slice(0, 6) + '...)');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) {
    console.error(
      '[GitHubOAuth] ❌ GITHUB_OAUTH_CLIENT_SECRET is missing from env vars.',
      'Go to your GitHub OAuth App settings → Client secrets and set it in backend/.env',
    );
    throw new Error('GITHUB_OAUTH_CLIENT_SECRET is not configured.');
  }
  console.log('[GitHubOAuth] ✅ GITHUB_OAUTH_CLIENT_SECRET loaded (length:', secret.length, ')');
  return secret;
}

/**
 * Exchange an authorization code for a verified GitHub profile.
 * @param code       the ?code from GitHub's redirect
 * @param redirectUri optional; must match the one used in the authorize step if GitHub enforces it
 */
export async function verifyGithubCode(
  code: string,
  redirectUri?: string,
): Promise<GithubVerifiedProfile> {
  console.log('[GitHubOAuth] ── Step 0: verifyGithubCode called ──');
  console.log('[GitHubOAuth]   code length:', code?.length ?? 'MISSING', '| redirectUri:', redirectUri ?? '(not provided)');

  if (!code || typeof code !== 'string') {
    console.error('[GitHubOAuth] ❌ Authorization code is missing or not a string. Value type:', typeof code);
    throw new Error('GitHub authorization code is required.');
  }

  // 1) code -> access token
  console.log('[GitHubOAuth] ── Step 1: Exchanging authorization code for access token ──');
  const clientId = getClientId();
  const tokenPayload: Record<string, string> = {
    client_id: clientId,
    client_secret: getClientSecret(),
    code,
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  };
  console.log('[GitHubOAuth]   POST https://github.com/login/oauth/access_token');
  console.log('[GitHubOAuth]   Body: { client_id:', clientId.slice(0, 6) + '..., code:', code.slice(0, 8) + '..., redirect_uri:', redirectUri ?? 'omitted', '}');

  let tokenRes: Response;
  try {
    tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokenPayload),
    });
  } catch (fetchErr) {
    console.error('[GitHubOAuth] ❌ Network error calling GitHub token endpoint. Cannot reach github.com.', fetchErr);
    throw new Error(`GitHub token exchange network error: ${(fetchErr as Error).message}`);
  }

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text().catch(() => '(could not read body)');
    console.error(
      '[GitHubOAuth] ❌ Token exchange HTTP error.',
      'Status:', tokenRes.status, tokenRes.statusText,
      'Body:', errorBody,
    );
    throw new Error(
      `GitHub token exchange failed (HTTP ${tokenRes.status} ${tokenRes.statusText}). ` +
      `Response: ${errorBody.slice(0, 200)}`,
    );
  }

  const tokenJson: any = await tokenRes.json();
  const accessToken: string | undefined = tokenJson?.access_token;

  if (!accessToken) {
    // GitHub returns 200 even on errors like "bad_verification_code"
    console.error(
      '[GitHubOAuth] ❌ Token exchange returned 200 but no access_token.',
      'error:', tokenJson?.error,
      'error_description:', tokenJson?.error_description,
      'error_uri:', tokenJson?.error_uri,
    );
    if (tokenJson?.error === 'bad_verification_code') {
      throw new Error(
        'GitHub authorization code is invalid or has already been used. ' +
        'Each code can only be exchanged once. If you refreshed the page after GitHub redirected, try signing in again.',
      );
    }
    throw new Error(
      `GitHub token exchange returned no access_token. ` +
      `Error: ${tokenJson?.error || 'unknown'} — ${tokenJson?.error_description || 'no description'}`,
    );
  }
  console.log('[GitHubOAuth] ✅ Access token received (length:', accessToken.length, ', scopes:', tokenJson?.scope || 'none reported', ')');

  // 2) access token -> profile
  console.log('[GitHubOAuth] ── Step 2: Fetching GitHub user profile ──');
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FixFlowAI',
  };

  let userRes: Response;
  try {
    userRes = await fetch('https://api.github.com/user', { headers });
  } catch (fetchErr) {
    console.error('[GitHubOAuth] ❌ Network error fetching GitHub user profile.', fetchErr);
    throw new Error(`GitHub profile fetch network error: ${(fetchErr as Error).message}`);
  }

  if (!userRes.ok) {
    const errorBody = await userRes.text().catch(() => '(could not read body)');
    console.error(
      '[GitHubOAuth] ❌ GitHub /user API error.',
      'Status:', userRes.status, userRes.statusText,
      'Body:', errorBody.slice(0, 300),
      'Rate-Limit-Remaining:', userRes.headers.get('x-ratelimit-remaining'),
    );
    if (userRes.status === 401) {
      throw new Error('GitHub access token was rejected (401 Unauthorized). The token may have been revoked or the scopes are insufficient.');
    }
    if (userRes.status === 403) {
      throw new Error(
        `GitHub API rate limit or permission error (403 Forbidden). ` +
        `Rate-Limit-Remaining: ${userRes.headers.get('x-ratelimit-remaining')}`,
      );
    }
    throw new Error(`GitHub profile fetch failed (HTTP ${userRes.status} ${userRes.statusText}).`);
  }
  const profile: any = await userRes.json();
  console.log('[GitHubOAuth] ✅ Profile fetched. login:', profile?.login, '| id:', profile?.id, '| name:', profile?.name);

  // 3) primary verified email (may be private on the profile response)
  console.log('[GitHubOAuth] ── Step 3: Fetching verified email ──');
  let email: string = profile?.email || '';
  let emailVerified = false;
  try {
    const emailRes = await fetch('https://api.github.com/user/emails', { headers });
    if (emailRes.ok) {
      const emails: any[] = await emailRes.json();
      console.log('[GitHubOAuth]   Found', emails.length, 'email(s) from /user/emails');
      const primary = emails.find((e) => e.primary) || emails.find((e) => e.verified) || emails[0];
      if (primary) {
        email = primary.email || email;
        emailVerified = Boolean(primary.verified);
        console.log('[GitHubOAuth]   ✅ Using email:', email, '| verified:', emailVerified);
      } else {
        console.log('[GitHubOAuth]   ⚠️ /user/emails returned entries but none matched primary/verified');
      }
    } else {
      console.log(
        '[GitHubOAuth]   ⚠️ /user/emails returned', emailRes.status,
        '— user:email scope may not be granted. Falling back to profile.email:',
        profile?.email || '(none)',
      );
    }
  } catch (emailErr) {
    console.log(
      '[GitHubOAuth]   ⚠️ /user/emails fetch failed (scope may be absent). Falling back to profile email.',
      (emailErr as Error).message,
    );
  }
  if (!email) {
    email = `${profile.login}@users.noreply.github.com`;
    console.log('[GitHubOAuth]   ⚠️ No real email found. Using noreply fallback:', email);
  }

  if (!profile?.id || !profile?.login) {
    console.error(
      '[GitHubOAuth] ❌ GitHub profile is missing required fields.',
      'id:', profile?.id, '| login:', profile?.login,
      'Full profile keys:', Object.keys(profile || {}),
    );
    throw new Error(
      `GitHub profile missing id/login. Got id=${profile?.id}, login=${profile?.login}. ` +
      `This usually means the access token is valid but the profile response was malformed.`,
    );
  }

  const result: GithubVerifiedProfile = {
    githubUserId: String(profile.id),
    githubUsername: profile.login,
    email,
    emailVerified,
    name: profile.name || profile.login,
    picture: profile.avatar_url,
    accessToken,
  };
  console.log(
    '[GitHubOAuth] ── ✅ verifyGithubCode complete ──',
    '| userId:', result.githubUserId,
    '| username:', result.githubUsername,
    '| email:', result.email,
    '| emailVerified:', result.emailVerified,
  );
  return result;
}
