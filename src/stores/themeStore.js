import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'modern-dark', // default theme
      setTheme: (newTheme) => set({ theme: newTheme }),
    }),
    {
      name: 'fixflowai-theme',
    }
  )
);

export default useThemeStore;
