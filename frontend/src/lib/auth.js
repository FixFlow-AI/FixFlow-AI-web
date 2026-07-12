/**
 * Client-side session manager.
 *
 * - Access token: short-lived JWT, sent as `Authorization: Bearer` on every API call.
 * - Refresh token + userId: used to mint a new access token when one expires.
 *
 * Tokens are kept in localStorage so a refresh survives a page reload. The
 * refresh call here uses bare fetch (not the api client) to avoid recursion.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const KEYS = {
  access: "ff_access_token",
  refresh: "ff_refresh_token",
  user: "ff_user",
};

export function getAccessToken() {
  return localStorage.getItem(KEYS.access) || null;
}

export function getRefreshToken() {
  return localStorage.getItem(KEYS.refresh) || null;
}

export function getUser() {
  const raw = localStorage.getItem(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken() && getUser());
}

export function setSession({ user, accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(KEYS.access, accessToken);
  if (refreshToken) localStorage.setItem(KEYS.refresh, refreshToken);
  if (user) localStorage.setItem(KEYS.user, JSON.stringify(user));
  checkAndRefreshIfNeeded();
}

export function updateAccessToken(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(KEYS.access, accessToken);
  if (refreshToken) localStorage.setItem(KEYS.refresh, refreshToken);
  checkAndRefreshIfNeeded();
}

export function clearSession() {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.user);
  if (proactiveTimer) {
    clearInterval(proactiveTimer);
    proactiveTimer = null;
  }
}

let refreshInFlight = null;
let proactiveTimer = null;

/**
 * Decodes the JWT payload to inspect claims (like exp).
 */
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Checks if the current access token is expiring in under 5 minutes and triggers a refresh if so.
 */
export async function checkAndRefreshIfNeeded() {
  const token = getAccessToken();
  if (!token) return;

  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== "number") return;

  const expiryTime = payload.exp * 1000;
  const timeUntilExpiry = expiryTime - Date.now();

  // If token expires in less than 5 minutes (300,000 ms), trigger refresh proactively.
  if (timeUntilExpiry < 5 * 60 * 1000) {
    console.log(
      `[Auth:Proactive] ⏳ Access token expiring in ${Math.round(
        timeUntilExpiry / 1000
      )}s. Proactively refreshing...`
    );
    await refreshAccessToken();
  }
}

/**
 * Starts the background interval to proactively refresh access tokens.
 */
export function startProactiveRefreshTimer() {
  if (proactiveTimer) return;

  // Run an immediate check on startup
  checkAndRefreshIfNeeded();

  // Check every 60 seconds
  proactiveTimer = setInterval(() => {
    checkAndRefreshIfNeeded();
  }, 60 * 1000);

  console.log("[Auth:Proactive] ⏱️ Proactive token refresh background timer started.");
}

/**
 * Exchanges the stored refresh token for a fresh access token.
 * De-duplicates concurrent calls so a burst of 401s triggers a single refresh.
 * Returns the new access token, or null if refresh failed (caller should log out).
 */
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  const user = getUser();
  if (!refreshToken || !user?.id) return null;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, userId: user.id }),
      });
      if (!res.ok) {
        clearSession();
        return null;
      }
      const data = await res.json();
      updateAccessToken(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
