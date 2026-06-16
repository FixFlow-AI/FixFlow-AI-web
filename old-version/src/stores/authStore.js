import { create } from 'zustand';
import api, { ensureCsrfToken, refreshAccessToken } from '../config/api';
import { clearAccessToken, setAccessToken } from '../lib/authToken';
import { getDashboardPathForRole, normalizeRole } from '../lib/authRoles';
import { logger } from '../lib/logger';

function encodeOAuthState(payload) {
  return window.btoa(JSON.stringify(payload));
}

const useAuthStore = create((set, get) => ({
  user: null,
  currentWorkspace: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setCurrentWorkspace: (currentWorkspace) => set({ currentWorkspace }),
  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
  updateCurrentWorkspace: (updates) =>
    set((state) => ({ currentWorkspace: state.currentWorkspace ? { ...state.currentWorkspace, ...updates } : null })),
  completeOAuthLogin: ({ accessToken, user, currentWorkspace = null }) => {
    if (accessToken) setAccessToken(accessToken);

    set({
      user: user || null,
      currentWorkspace: currentWorkspace || null,
      isAuthenticated: !!accessToken,
      isLoading: false,
    });
  },

  register: async ({ email, password, name, role = 'client', selectedPlan = 'free', defaultEntryMode = 'individual', teamPlanPreference = 'free' }) => {
    const { data } = await api.post('/auth/register', {
      email,
      password,
      name,
      role: normalizeRole(role),
      selectedPlan,
      plan: selectedPlan,
      defaultEntryMode,
      teamPlanPreference,
    });
    setAccessToken(data.accessToken);
    set({ user: data.user, currentWorkspace: data.currentWorkspace || null, isAuthenticated: true });
    return data;
  },

  login: async ({ email, password, role = 'client', entryMode = null }) => {
    const { data } = await api.post('/auth/login', { email, password, role: normalizeRole(role), entryMode });
    setAccessToken(data.accessToken);
    set({ user: data.user, currentWorkspace: data.currentWorkspace || null, isAuthenticated: true });
    return data;
  },

  startOAuthLogin: async ({ provider, role = 'client', selectedPlan = 'free', flow = 'login', entryMode = 'individual', returnTo = '' }) => {
    const state = encodeOAuthState({
      frontendOrigin: window.location.origin,
      flow,
      role: normalizeRole(role),
      selectedPlan,
      entryMode: entryMode === 'team' ? 'team' : 'individual',
      returnTo,
    });

    const { data } = await api.get(`/auth/${provider}/url`, {
      params: { state },
    });

    if (!data?.authUrl) {
      throw new Error(`${provider === 'google' ? 'Google' : 'GitHub'} login is not available right now.`);
    }

    window.location.href = data.authUrl;
  },

  startGithubLogin: async (entryMode = 'individual') => {
    return get().startOAuthLogin({
      provider: 'github',
      role: 'client',
      selectedPlan: 'free',
      flow: 'login',
      entryMode,
      returnTo: getDashboardPathForRole('client'),
    });
  },

  startGoogleLogin: async (options) => get().startOAuthLogin({ provider: 'google', ...options }),

  logout: async () => {
    try {
      await ensureCsrfToken();
      await api.post('/auth/logout', {});
    } catch (err) {
      // Silently fail — still clear local state
      logger.warn('Auth Store Logout', 'Failed to call logout endpoint. Clearing local session anyway.', { error: err });
    }
    clearAccessToken();
    set({ user: null, currentWorkspace: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      if (!get().isAuthenticated) {
        await refreshAccessToken();
      }
      const { data } = await api.get('/auth/me');
      set({ user: data.user, currentWorkspace: data.currentWorkspace || null, isAuthenticated: true, isLoading: false });
    } catch (err) {
      logger.info('Auth Store Check', 'User session check failed or session expired. Redirecting to unauthenticated state.', { error: err });
      clearAccessToken();
      set({ user: null, currentWorkspace: null, isAuthenticated: false, isLoading: false });
    }
  },
}));


export default useAuthStore;
