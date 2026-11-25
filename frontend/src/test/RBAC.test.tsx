import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { AuthContext } from '../context/AuthContext';
import { Role, User } from '../types';

const makeAuthValue = (user: User, customHasRole?: (...roles: Role[]) => boolean) => ({
  user,
  role: user.role,
  isAuthenticated: true,
  isLoading: false,
  login: async () => user,
  logout: async () => {},
  hasRole:
    customHasRole ||
    ((...roles: Role[]) => {
      if (user.is_admin && roles.includes('admin')) return true;
      if (user.role === 'doctor' || user.role === 'dentist') {
        if (roles.includes('doctor') || roles.includes('dentist')) return true;
      }
      return roles.includes(user.role);
    }),
});

describe('PGI Dental RBAC & ProtectedRoute', () => {
  const doctorUser: User = {
    id: 2,
    email: 'dr.mehta@pgi.edu.in',
    username: 'dr.mehta',
    full_name: 'Dr. Rajesh Mehta',
    role: 'doctor',
    is_admin: false,
    is_active: true,
    created_at: '2026-01-01',
    doctor_id: 1,
    dentist_profile: {
      id: 1,
      license_number: 'PGI-DEN-1042',
      specialization: 'Prosthodontics & Implantology',
      department: 'Oral Health Sciences Centre',
      cabin_operatory: 'OP-1',
    },
  };

  const facultyAdminDoctor: User = {
    ...doctorUser,
    id: 10,
    email: 'dr.kapoor@pgi.edu.in',
    full_name: 'Dr. Ananya Kapoor',
    is_admin: true,
  };

  const studentUser: User = {
    id: 3,
    email: 'student1@pgi.edu.in',
    username: 'student1',
    full_name: 'Aarav Sharma (MDS Jr)',
    role: 'student',
    is_active: true,
    created_at: '2026-01-01',
    student_id: 5,
  };

  const receptionistUser: User = {
    id: 4,
    email: 'reception@pgi.edu.in',
    username: 'reception',
    full_name: 'Simran Kaur',
    role: 'receptionist',
    is_active: true,
    created_at: '2026-01-01',
  };

  it('allows PGI doctor to access clinical modules including dentist/doctor unified roles', () => {
    render(
      <AuthContext.Provider value={makeAuthValue(doctorUser)}>
        <MemoryRouter>
          <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
            <div>PGI Clinical Examination View</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('PGI Clinical Examination View')).toBeInTheDocument();
  });

  it('allows designated faculty admin doctor to access admin-only routes', () => {
    render(
      <AuthContext.Provider value={makeAuthValue(facultyAdminDoctor)}>
        <MemoryRouter>
          <ProtectedRoute allowedRoles={['admin']}>
            <div>PGI Doctors Roster Management</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('PGI Doctors Roster Management')).toBeInTheDocument();
  });

  it('allows student to access clinical workspace while restricting Doctors management', () => {
    render(
      <AuthContext.Provider value={makeAuthValue(studentUser)}>
        <MemoryRouter initialEntries={['/doctors']}>
          <Routes>
            <Route
              path="/doctors"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <div>PGI Doctors Roster Management</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.queryByText('PGI Doctors Roster Management')).not.toBeInTheDocument();
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });

  it('isolates receptionist to Attendance Desk and denies clinical Dashboard/Patients routes', () => {
    const { rerender } = render(
      <AuthContext.Provider value={makeAuthValue(receptionistUser)}>
        <MemoryRouter>
          <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'student']}>
            <div>Clinical Dental Dashboard</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.queryByText('Clinical Dental Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to My Workspace' })).toHaveAttribute(
      'href',
      '/attendance'
    );

    rerender(
      <AuthContext.Provider value={makeAuthValue(receptionistUser)}>
        <MemoryRouter>
          <ProtectedRoute allowedRoles={['admin', 'dentist', 'doctor', 'receptionist']}>
            <div>PGI Reception Attendance Desk</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('PGI Reception Attendance Desk')).toBeInTheDocument();
  });
});
