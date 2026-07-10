import { OAuth2Client } from 'google-auth-library';

/**
 * Verifies a Google ID token (the JWT a browser obtains via Google Identity
 * Services / "Sign in with Google"). On success returns the verified profile
 * fields we care about. Any failure throws.
 *
 * This is the simplest, most secure way to integrate Google sign-in for an
 * SPA + backend: the SPA gets the ID token client-side; the backend only ever
 * validates it. We never see a Google access token, refresh token, or secret.
 */

let cachedClient: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (cachedClient) return cachedClient;
  cachedClient = new OAuth2Client();
  return cachedClient;
}

function getAllowedAudiences(): string[] {
  const primary = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!primary) {
    console.error(
      '[GoogleOAuth] ❌ GOOGLE_OAUTH_CLIENT_ID is missing from env vars.',
      'Create an OAuth 2.0 Client ID (Web) in Google Cloud Console and set it in backend/.env',
    );
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID is not configured. Create an OAuth 2.0 Client ID (Web) in Google Cloud Console.',
    );
  }
  const extras = (process.env.GOOGLE_OAUTH_ALLOWED_AUDIENCES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  console.log('[GoogleOAuth] ✅ Audiences loaded. Primary:', primary.slice(0, 12) + '...', '| extra audiences:', extras.length);
  return [primary, ...extras];
}

export interface GoogleVerifiedProfile {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleVerifiedProfile> {
  console.log('[GoogleOAuth] verifyGoogleIdToken called. idToken length:', idToken?.length ?? 'MISSING');
  if (!idToken || typeof idToken !== 'string') {
    console.error('[GoogleOAuth] ❌ idToken is missing or not a string.');
    throw new Error('idToken is required.');
  }

  const audience = getAllowedAudiences();
  let ticket;
  try {
    ticket = await getClient().verifyIdToken({ idToken, audience });
  } catch (verifyErr) {
    console.error('[GoogleOAuth] ❌ google-auth-library verifyIdToken threw:', (verifyErr as Error).message);
    throw verifyErr;
  }
  const payload = ticket.getPayload();
  if (!payload) {
    console.error('[GoogleOAuth] ❌ ID token verified but getPayload() returned null/undefined.');
    throw new Error('Google ID token has no payload.');
  }

  // Defence in depth: google-auth-library already validates iss/exp/aud, but
  // these checks make our expectations explicit and fail loudly on drift.
  const iss = payload.iss;
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
    console.error('[GoogleOAuth] ❌ Unexpected token issuer:', iss);
    throw new Error(`Unexpected ID token issuer: ${iss}`);
  }
  if (!payload.sub) {
    console.error('[GoogleOAuth] ❌ Token payload missing "sub" claim. Keys:', Object.keys(payload));
    throw new Error('Google ID token missing sub claim.');
  }
  if (!payload.email) {
    console.error('[GoogleOAuth] ❌ Token payload missing "email" claim. sub:', payload.sub);
    throw new Error('Google ID token missing email claim.');
  }

  const profile: GoogleVerifiedProfile = {
    googleSub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name || payload.email,
    picture: payload.picture,
  };
  console.log('[GoogleOAuth] ✅ Token verified. sub:', profile.googleSub, '| email:', profile.email, '| emailVerified:', profile.emailVerified);
  return profile;
}
