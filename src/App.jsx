import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { PageLoader } from './components/ui/PageLoader'
import useThemeStore from './stores/themeStore'
import RouteTransition from './components/layout/RouteTransition'

const Landing = lazy(() => import('./pages/Landing'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function AppRoutes() {
  return (
    <RouteTransition>
      <AnimatePresence mode="wait">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/waitlist" element={<Landing />} />
            <Route path="/" element={<Navigate to="/waitlist" replace />} />
            <Route path="*" element={<Navigate to="/waitlist" replace />} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </RouteTransition>
  )
}

function ThemeController() {
  const theme = useThemeStore((s) => s.theme)
  const hydrateTheme = useThemeStore((s) => s.hydrateTheme)

  useEffect(() => {
    hydrateTheme(theme)
  }, [hydrateTheme, theme])

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-vscode-dark', 'theme-modern-dark')
    document.documentElement.classList.add(`theme-${theme}`)
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
  }, [theme])

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeController />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </QueryClientProvider>
  )
}

export default App
