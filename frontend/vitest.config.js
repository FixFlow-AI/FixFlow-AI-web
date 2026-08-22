import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test-only config, kept separate from vite.config.js so the dev/build pipeline
// carries no test concerns. The React plugin is reused so JSX in component
// tests compiles the same way it does in the app.
export default defineConfig({
  plugins: [react()],
  test: {
    // Components under test touch the DOM (focus, matchMedia, scroll containers).
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Tests live beside the code they validate, in __tests__ folders.
    include: ['src/**/__tests__/**/*.{test,prop.test}.{js,jsx}'],
  },
})
