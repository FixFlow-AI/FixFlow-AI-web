import { useEffect, useRef, useState } from "react";
import { useLandingStore } from "../store/useLandingStore";
import { api, ApiError } from "../lib/api";
import { setSession } from "../lib/auth";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

/** Loads the Google Identity Services script once. */
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Renders the official "Sign in with Google" button. On success it exchanges
 * the Google ID token with our backend, stores the session, and navigates
 * into the dashboard. `nextHash` controls where to land after sign-in.
 */
export function GoogleSignInButton({ nextHash = "#/dashboard/overview", roleToSet = null }) {
  const containerRef = useRef(null);
  const login = useLandingStore((s) => s.login);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!CLIENT_ID) {
      setError("Google sign-in is not configured (VITE_GOOGLE_CLIENT_ID missing).");
      return;
    }

    const handleCredential = async (response) => {
      setBusy(true);
      setError("");
      try {
        const { user, accessToken, refreshToken } = await api.googleLogin(
          response.credential,
        );
        setSession({ user, accessToken, refreshToken });
        login(user);
        // On signup, apply the chosen role to the freshly created account.
        if (roleToSet && roleToSet !== user.role) {
          try {
            const { user: updated } = await api.setRole(roleToSet);
            setSession({ user: updated });
            login(updated);
          } catch {
            /* non-fatal: role can be changed later in settings */
          }
        }
        window.location.hash = nextHash;
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Sign-in failed. Please try again.",
        );
      } finally {
        setBusy(false);
      }
    };

    loadGis()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredential,
        });
        if (containerRef.current) {
          window.google.accounts.id.renderButton(containerRef.current, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "continue_with",
            shape: "rectangular",
          });
        }
      })
      .catch(() => setError("Could not load Google sign-in. Check your connection."));

    return () => {
      cancelled = true;
    };
  }, [login, nextHash, roleToSet]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} aria-busy={busy} />
      {busy && (
        <p className="text-xs text-slate-500">Signing you in…</p>
      )}
      {error && (
        <p
          className="text-xs text-[#C2410C] bg-orange-50 border border-orange-200 rounded p-2"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
