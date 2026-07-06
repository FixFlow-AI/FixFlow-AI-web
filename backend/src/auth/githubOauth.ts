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
    throw new Error(
      'GITHUB_OAUTH_CLIENT_ID is not configured. Create an OAuth App at https://github.com/settings/developers.',
    );
  }
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) throw new Error('GITHUB_OAUTH_CLIENT_SECRET is not configured.');
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
  if (!code || typeof code !== 'string') {
    throw new Error('GitHub authorization code is required.');
  }

  // 1) code -> access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`GitHub token exchange failed (${tokenRes.status}).`);
  }
  const tokenJson: any = await tokenRes.json();
  const accessToken: string | undefined = tokenJson?.access_token;
  if (!accessToken) {
    throw new Error(`GitHub token exchange returned no access_token (${tokenJson?.error || 'unknown'}).`);
  }

  // 2) access token -> profile
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FixFlowAI',
  };
  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) throw new Error(`GitHub profile fetch failed (${userRes.status}).`);
  const profile: any = await userRes.json();

  // 3) primary verified email (may be private on the profile response)
  let email: string = profile?.email || '';
  let emailVerified = false;
  try {
    const emailRes = await fetch('https://api.github.com/user/emails', { headers });
    if (emailRes.ok) {
      const emails: any[] = await emailRes.json();
      const primary = emails.find((e) => e.primary) || emails.find((e) => e.verified) || emails[0];
      if (primary) {
        email = primary.email || email;
        emailVerified = Boolean(primary.verified);
      }
    }
  } catch {
    /* email scope may be absent; fall back to profile email */
  }
  if (!email) email = `${profile.login}@users.noreply.github.com`;

  if (!profile?.id || !profile?.login) {
    throw new Error('GitHub profile missing id/login.');
  }

  return {
    githubUserId: String(profile.id),
    githubUsername: profile.login,
    email,
    emailVerified,
    name: profile.name || profile.login,
    picture: profile.avatar_url,
    accessToken,
  };
}
