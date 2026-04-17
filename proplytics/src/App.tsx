import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import NewProposal from './pages/NewProposal'
import ProposalResult from './pages/ProposalResult'
import DashboardLayout from './components/layout/DashboardLayout'

function App() {
  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />
          <Route
            path="/new"
            element={
              <DashboardLayout>
                <NewProposal />
              </DashboardLayout>
            }
          />
          <Route
            path="/proposal/:id"
            element={
              <DashboardLayout>
                <ProposalResult />
              </DashboardLayout>
            }
          />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  )
}

export default App
