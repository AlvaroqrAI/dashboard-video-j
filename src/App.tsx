import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminRoute from '@/components/AdminRoute'
import ClientRoute from '@/components/ClientRoute'
import PaymentGate from '@/components/PaymentGate'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdminLayout from '@/components/layout/AdminLayout'

import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import Onboarding from '@/pages/Onboarding'

// Cliente
import Dashboard from '@/pages/Dashboard'
import Agents from '@/pages/Agents'
import Calls from '@/pages/Calls'
import PhoneNumbers from '@/pages/PhoneNumbers'
import Billing from '@/pages/Billing'
import Settings from '@/pages/Settings'

// Admin
import AdminDashboard from '@/pages/admin/AdminDashboard'
import Clients from '@/pages/admin/Clients'
import ClientDetail from '@/pages/admin/ClientDetail'
import AdminAgents from '@/pages/admin/AdminAgents'
import AdminCalls from '@/pages/admin/AdminCalls'
import Plans from '@/pages/admin/Plans'
import AdminSettings from '@/pages/admin/AdminSettings'
import Alerts from '@/pages/admin/Alerts'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Panel de administración */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="clients" element={<Clients />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="agents" element={<AdminAgents />} />
                <Route path="calls" element={<AdminCalls />} />
                <Route path="plans" element={<Plans />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Route>

            {/* Panel de cliente (solo clientes, requiere método de pago) */}
            <Route element={<ClientRoute />}>
              <Route element={<PaymentGate />}>
                <Route element={<DashboardLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="calls" element={<Calls />} />
                  <Route path="phone-numbers" element={<PhoneNumbers />} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
