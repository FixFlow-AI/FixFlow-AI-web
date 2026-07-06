import { Github } from "lucide-react";

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "";
// GitHub redirects back to this URL with ?code=...&state=... The App reads it on load.
const REDIRECT_URI =
  import.meta.env.VITE_GITHUB_REDIRECT_URI || `${window.location.origin}/`;

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
    if (disabled) return;
    // CSRF state: a random nonce echoed back by GitHub and re-checked on return.
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(ROLE_KEY, intendedRole);
    sessionStorage.setItem(NEXT_KEY, nextHash);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "read:user user:email public_repo", // minimum needed to scan public repos
      state,
      allow_signup: "true",
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
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

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const intendedRole = sessionStorage.getItem(ROLE_KEY) || "freelancer";
  const nextHash = sessionStorage.getItem(NEXT_KEY) || "#/dashboard/role-onboarding";

  // Clean the URL immediately so a refresh doesn't re-trigger the exchange.
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url.pathname + url.hash);

  if (!expectedState || state !== expectedState) {
    return { error: "GitHub sign-in state mismatch. Please try again." };
  }
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(NEXT_KEY);

  const redirectUri =
    import.meta.env.VITE_GITHUB_REDIRECT_URI || `${window.location.origin}/`;

  try {
    const { user, accessToken, refreshToken } = await api.githubLogin(
      code,
      intendedRole,
      redirectUri,
    );
    setSession({ user, accessToken, refreshToken });
    login(user);
    return { nextHash };
  } catch (err) {
    return { error: err?.message || "GitHub sign-in failed." };
  }
}
