// Global test setup, loaded by vitest.config.js before any test file runs.
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom has no matchMedia. Default to "no preference" so motion-aware hooks
// (usePrefersReducedMotion) get a valid MediaQueryList; individual tests
// override this stub when they need `prefers-reduced-motion: reduce`.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
