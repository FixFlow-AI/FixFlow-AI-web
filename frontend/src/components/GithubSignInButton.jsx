import { Github } from "lucide-react";

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "";
// GitHub redirects back to this URL with ?code=...&state=... The App reads it on load.
const REDIRECT_URI =
  import.meta.env.VITE_GITHUB_REDIRECT_URI || `${window.location.origin}/`;

if (!CLIENT_ID) {
  console.warn(
    '[GitHubOAuth:FE] ⚠️ VITE_GITHUB_CLIENT_ID is not set in .env.',
    'GitHub sign-in button will be disabled.',
    'Set it in frontend/.env (e.g. VITE_GITHUB_CLIENT_ID=Ov23li...)',
  );
} else {
  console.log('[GitHubOAuth:FE] ✅ GitHub OAuth configured. CLIENT_ID starts with:', CLIENT_ID.slice(0, 8) + '...');
  console.log('[GitHubOAuth:FE]   REDIRECT_URI:', REDIRECT_URI);
}

const STATE_KEY = "ff_github_oauth_state";
const ROLE_KEY = "ff_github_intended_role";
const NEXT_KEY = "ff_github_next_hash";

/**
 * Starts GitHub's authorization-code flow. We can't use a popup token like
 * Google — GitHub needs a server-side code exchange (the backend swaps the
 * code for an access token to read repos). So this button redirects to GitHub;
 * the return trip is handled by `handleGithubRedirect()` in App.jsx.
 *
 * `intendedRole` (freelancer | developer) is stashed in sessionStorage and
 * validated by the backend after the exchange.
 */
export function GithubSignInButton({
  intendedRole = "freelancer",
  nextHash = "#/dashboard/role-onboarding",
  label = "Continue with GitHub",
}) {
  const disabled = !CLIENT_ID;

  const start = () => {
    if (disabled) {
      console.error('[GitHubOAuth:FE] ❌ Start blocked: CLIENT_ID is empty. Check VITE_GITHUB_CLIENT_ID in frontend/.env');
      return;
    }
    // CSRF state: a random nonce echoed back by GitHub and re-checked on return.
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(ROLE_KEY, intendedRole);
    sessionStorage.setItem(NEXT_KEY, nextHash);
    console.log('[GitHubOAuth:FE] 🚀 Starting GitHub OAuth flow');
    console.log('[GitHubOAuth:FE]   intendedRole:', intendedRole, '| nextHash:', nextHash);
    console.log('[GitHubOAuth:FE]   CSRF state:', state.slice(0, 8) + '...');

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "read:user user:email public_repo", // minimum needed to scan public repos
      state,
      allow_signup: "true",
    });
    const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    console.log('[GitHubOAuth:FE]   Redirecting to:', authorizeUrl.slice(0, 100) + '...');
    window.location.href = authorizeUrl;
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "11px 16px",
          background: "#0f172a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Github size={16} /> {label}
      </button>
      {disabled && (
        <p style={{ fontSize: 12, color: "#C2410C", margin: 0 }}>
          GitHub sign-in is not configured (VITE_GITHUB_CLIENT_ID missing).
        </p>
      )}
    </div>
  );
}

// ── Redirect handler (called once on app load from App.jsx) ─────────────────

export const GITHUB_OAUTH_KEYS = { STATE_KEY, ROLE_KEY, NEXT_KEY };

/**
 * Detects a GitHub OAuth return (?code=&state=), exchanges the code via the
 * backend, stores the session, and returns the next hash to navigate to.
 * Returns null when this is not a GitHub callback.
 */
export async function handleGithubRedirect({ api, setSession, login }) {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return null;

  console.log('[GitHubOAuth:FE] 🔄 GitHub redirect detected');
  console.log('[GitHubOAuth:FE]   code:', code.slice(0, 8) + '... (len ' + code.length + ')');
  console.log('[GitHubOAuth:FE]   state:', state.slice(0, 8) + '...');

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const intendedRole = sessionStorage.getItem(ROLE_KEY) || "freelancer";
  const nextHash = sessionStorage.getItem(NEXT_KEY) || "#/dashboard/role-onboarding";
  console.log('[GitHubOAuth:FE]   expectedState:', expectedState ? expectedState.slice(0, 8) + '...' : 'MISSING (sessionStorage empty)');
  console.log('[GitHubOAuth:FE]   intendedRole:', intendedRole, '| nextHash:', nextHash);

  // Clean the URL immediately so a refresh doesn't re-trigger the exchange.
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url.pathname + url.hash);

  if (!expectedState || state !== expectedState) {
    console.error(
      '[GitHubOAuth:FE] ❌ CSRF state mismatch!',
      'Expected:', expectedState?.slice(0, 8) ?? 'MISSING',
      '| Got:', state.slice(0, 8),
      '| This can happen if: (1) you opened the app in a new tab, (2) sessionStorage was cleared, (3) a CSRF attack.',
    );
    return { error: "GitHub sign-in state mismatch. Please try again." };
  }
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(NEXT_KEY);

  const redirectUri =
    import.meta.env.VITE_GITHUB_REDIRECT_URI || `${window.location.origin}/`;

  console.log('[GitHubOAuth:FE]   Calling backend POST /api/auth/github...');
  try {
    const { user, accessToken, refreshToken, scanJobId } = await api.githubLogin(
      code,
      intendedRole,
      redirectUri,
    );
    console.log('[GitHubOAuth:FE] ✅ GitHub login successful. userId:', user?.id, '| email:', user?.email, '| role:', user?.role);
    setSession({ user, accessToken, refreshToken });
    login(user);
    // Stash the scan job so the onboarding view can stream its segments live.
    if (scanJobId) sessionStorage.setItem("ff_scan_job_id", scanJobId);
    return { nextHash };
  } catch (err) {
    console.error(
      '[GitHubOAuth:FE] ❌ Backend exchange failed.',
      'Error:', err?.message || err,
      '| Status:', err?.status || 'N/A',
      '| Possible causes: (1) backend not running, (2) GITHUB_OAUTH_CLIENT_SECRET wrong in backend/.env,',
      '(3) code already used (page refresh), (4) redirect_uri mismatch between frontend and GitHub App settings.',
    );
    return { error: err?.message || "GitHub sign-in failed." };
  }
}
