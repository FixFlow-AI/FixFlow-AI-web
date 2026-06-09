import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'light', // default theme set to light
      setTheme: (newTheme) => set({ theme: newTheme }),
      hydrateTheme: (newTheme) => set({ theme: newTheme || 'light' }),
    }),
    {
      name: 'fixflowai-theme',
    }
  )
);

export default useThemeStore;
