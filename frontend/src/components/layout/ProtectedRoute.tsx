import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

interface ProtectedRouteProps {
    children: React.ReactElement;
    allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, isAuthenticated, isLoading, hasRole } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
                <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Initializing PGI Dental System...
                </p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !hasRole(...allowedRoles)) {
        const homePath =
            user?.role === 'patient'
                ? '/portal/appointments'
                : user?.role === 'receptionist'
                    ? '/attendance'
                    : '/dashboard';

        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-lg mb-3">
                    ✕
                </div>
                <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Your user role does not have authorization to view this clinical module. Contact the PGI Dental administrator if you believe this is an error.
                </p>
                <Link
                    to={homePath}
                    className="mt-4 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition"
                >
                    Return to My Workspace
                </Link>
            </div>
        );
    }

    return children;
};
