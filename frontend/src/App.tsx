import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import PatientLayout from './components/layout/PatientLayout';

// Staff & Clinical Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import PatientTracker from './pages/PatientTracker';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import PatientCare from './pages/PatientCare';
import Doctors from './pages/Doctors';
import Students from './pages/Students';
import Treatments from './pages/Treatments';
import Prescriptions from './pages/Prescriptions';
import Xrays from './pages/Xrays';
import Followups from './pages/Followups';
import Documents from './pages/Documents';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import NotFound from './pages/NotFound';

// Locked Patient Portal Pages
import PatientAppointments from './pages/patient/PatientAppointments';
import PatientPrescriptions from './pages/patient/PatientPrescriptions';
import PatientSharedRecords from './pages/patient/PatientSharedRecords';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

/**
 * Dispatches authenticated users to their designated landing module:
 * - Patient -> Patient Portal (/portal/appointments)
 * - Receptionist -> Attendance Desk (/attendance)
 * - Clinical Staff / Admin -> Dashboard (/dashboard)
 */
const RootRedirect: React.FC = () => {
    const { user } = useAuth();
    if (user?.role === 'patient') {
        return <Navigate to="/portal/appointments" replace />;
    }
    if (user?.role === 'receptionist') {
        return <Navigate to="/attendance" replace />;
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

                        {/* Root Role Dispatcher */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <RootRedirect />
                                </ProtectedRoute>
                            }
                        />

                        {/* Authenticated Locked Patient Portal (3 Tabs Only) */}
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
                            <Route path="prescriptions" element={<PatientPrescriptions />} />
                            <Route path="shared-records" element={<PatientSharedRecords />} />
                            <Route path="xrays" element={<Navigate to="/portal/shared-records" replace />} />
                        </Route>

                        {/* Authenticated PGI Dental Clinical & Desk Portal */}
                        <Route
                            element={
                                <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student', 'receptionist']}>
                                    <MainLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route
                                path="attendance"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'receptionist']}>
                                        <Attendance />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="dashboard"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <Dashboard />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="tracker"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <PatientTracker />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="patients"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <Patients />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="patients/:id"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <PatientDetail />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="appointments"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <Appointments />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="patient-care"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <PatientCare />
                                    </ProtectedRoute>
                                }
                            />
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
                            <Route
                                path="followups"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <Followups />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="documents"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
                                        <Documents />
                                    </ProtectedRoute>
                                }
                            />
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
