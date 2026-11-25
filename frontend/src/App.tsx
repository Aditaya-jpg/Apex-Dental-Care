import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import PatientLayout from './components/layout/PatientLayout';

// Staff Clinical Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import Treatments from './pages/Treatments';
import Prescriptions from './pages/Prescriptions';
import Xrays from './pages/Xrays';
import Followups from './pages/Followups';
import Documents from './pages/Documents';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import Doctors from './pages/Doctors';
import Students from './pages/Students';
import NotFound from './pages/NotFound';

// Patient Portal Pages
import PatientAppointments from './pages/patient/PatientAppointments';
import PatientXrays from './pages/patient/PatientXrays';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Dispatches the authenticated user to their respective landing module
 * (Patient Portal for patients, Clinical Dashboard for staff/doctors).
 */
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'patient') {
    return <Navigate to="/portal/appointments" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<Login />} />

            {/* Root Landing Route: Role-based Dispatcher */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RootRedirect />
                </ProtectedRoute>
              }
            />

            {/* Authenticated Patient Portal */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={['patient', 'admin']}>
                  <PatientLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/portal/appointments" replace />} />
              <Route path="appointments" element={<PatientAppointments />} />
              <Route path="xrays" element={<PatientXrays />} />
            </Route>

            {/* Authenticated Clinical Staff Portal */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student', 'receptionist']}>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="patients/:id" element={<PatientDetail />} />
              <Route path="appointments" element={<Appointments />} />

              {/* Hierarchy: Doctors & Students Management */}
              <Route
                path="doctors"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Doctors />
                  </ProtectedRoute>
                }
              />
              <Route
                path="students"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor']}>
                    <Students />
                  </ProtectedRoute>
                }
              />

              {/* Clinical Specific Modules */}
              <Route
                path="treatments"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor']}>
                    <Treatments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prescriptions"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor']}>
                    <Prescriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="xrays"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                    <Xrays />
                  </ProtectedRoute>
                }
              />

              {/* Shared Clinical Operations */}
              <Route path="followups" element={<Followups />} />
              <Route path="documents" element={<Documents />} />

              {/* Compliance & Admin */}
              <Route
                path="audit-logs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Users />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
