import { create } from 'zustand';
import api from '../config/api';
import { getDashboardPathForRole, normalizeRole } from '../lib/authRoles';

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
  completeOAuthLogin: ({ accessToken, refreshToken, user, currentWorkspace = null }) => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

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
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, currentWorkspace: data.currentWorkspace || null, isAuthenticated: true });
    return data;
  },

  login: async ({ email, password, role = 'client', entryMode = null }) => {
    const { data } = await api.post('/auth/login', { email, password, role: normalizeRole(role), entryMode });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
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
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Silently fail — still clear local state
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, currentWorkspace: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ user: null, currentWorkspace: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, currentWorkspace: data.currentWorkspace || null, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, currentWorkspace: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default useAuthStore;
