import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import DashboardLayout from './components/layout/DashboardLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import useAuthStore from './stores/authStore'
import { PageLoader } from './components/ui/PageLoader'
import { getDashboardPathForRole, normalizeRole } from './lib/authRoles'

const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Developer = lazy(() => import('./pages/Developer'))
const NewProposal = lazy(() => import('./pages/NewProposal'))
const ProposalResult = lazy(() => import('./pages/ProposalResult'))
const ProposalPortal = lazy(() => import('./pages/ProposalPortal'))
const Analytics = lazy(() => import('./pages/Analytics'))
const AgencyBrain = lazy(() => import('./pages/AgencyBrain'))
const TriProposal = lazy(() => import('./pages/TriProposal'))
const Workspace = lazy(() => import('./pages/Workspace'))
const WorkspaceSettings = lazy(() => import('./pages/WorkspaceSettings'))
const JoinWorkspace = lazy(() => import('./pages/JoinWorkspace'))
const Settings = lazy(() => import('./pages/Settings'))
const Billing = lazy(() => import('./pages/Billing'))
const Help = lazy(() => import('./pages/Help'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const FreelancerFlowBoard = lazy(() => import('./pages/freelancer/FlowBoard'))
const FreelancerNiches = lazy(() => import('./pages/freelancer/NicheAnalysis'))
const FreelancerLeads = lazy(() => import('./pages/freelancer/LeadPipeline'))
const FreelancerOutreach = lazy(() => import('./pages/freelancer/OutreachQueue'))
const FreelancerEscrows = lazy(() => import('./pages/freelancer/Escrows'))
const FreelancerIdentity = lazy(() => import('./pages/freelancer/IdentityVault'))
const FreelancerSettings = lazy(() => import('./pages/freelancer/FreelancerSettings'))
const FreelancerOnboarding = lazy(() => import('./pages/freelancer/Onboarding'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

import RouteTransition from './components/layout/RouteTransition'

function AppRoutes() {
  const checkAuth = useAuthStore((s) => s.checkAuth)
  const completeOAuthLogin = useAuthStore((s) => s.completeOAuthLogin)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    const encodedUser = params.get('user')
    const entryMode = params.get('mode') === 'team' ? 'team' : 'individual'
    const redirectTo = params.get('redirectTo')

    if (!accessToken || !refreshToken) {
      return
    }

    try {
      const user = encodedUser ? JSON.parse(atob(encodedUser)) : null
      completeOAuthLogin({ accessToken, refreshToken, user })
      const dashboardPath = redirectTo || (entryMode === 'team' ? '/workspace' : getDashboardPathForRole(normalizeRole(user?.role)))
      navigate(dashboardPath, { replace: true })
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      navigate('/login', { replace: true })
    }
  }, [completeOAuthLogin, location.search, navigate])

  return (
    <RouteTransition>
      <AnimatePresence mode="wait">
        <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/p/:token" element={<ProposalPortal />} />
        <Route path="/join/:token" element={<JoinWorkspace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/developer"
          element={
            <ProtectedRoute allowedRoles={['developer']}>
              <DashboardLayout>
                <Developer />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/new"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <NewProposal />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proposal/:id"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProposalResult />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Billing />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Analytics />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency-brain"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AgencyBrain />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tri/:tripId"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <TriProposal />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Workspace />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <WorkspaceSettings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Help />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerFlowBoard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/onboarding"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerOnboarding />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/niches"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerNiches />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/leads"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerLeads />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/outreach"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerOutreach />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/escrows"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerEscrows />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/identity"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerIdentity />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelancer/settings"
          element={
            <ProtectedRoute allowedRoles={['freelancer']}>
              <DashboardLayout>
                <FreelancerSettings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </AnimatePresence>
    </RouteTransition>
  )
}

import useThemeStore from './stores/themeStore'

function ThemeController() {
  const theme = useThemeStore((s) => s.theme)
  const hydrateTheme = useThemeStore((s) => s.hydrateTheme)
  const userTheme = useAuthStore((s) => s.user?.theme)

  useEffect(() => {
    if (userTheme && userTheme !== theme) {
      hydrateTheme(userTheme)
    }
  }, [hydrateTheme, theme, userTheme])
  
  useEffect(() => {
    // Remove all previous theme classes
    document.documentElement.classList.remove('theme-light', 'theme-vscode-dark', 'theme-modern-dark')
    // Add new theme class
    document.documentElement.classList.add(`theme-${theme}`)
    
    // Update color-scheme for native elements
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
