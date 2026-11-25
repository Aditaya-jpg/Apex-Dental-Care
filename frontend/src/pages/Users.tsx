import React, { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users as UsersIcon,
    UserPlus,
    Search,
    Shield,
    Stethoscope,
    Phone,
    Mail,
    CheckCircle,
    XCircle,
    GraduationCap,
} from 'lucide-react';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { Role, User } from '../types';
import Modal from '../components/common/Modal';

export default function Users() {
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();

    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [newEmail, setNewEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newFullName, setNewFullName] = useState('');
    const [newRole, setNewRole] = useState<Role>('doctor');
    const [newPhone, setNewPhone] = useState('');
    const [newLicense, setNewLicense] = useState('');
    const [newSpec, setNewSpec] = useState('');
    const [newQual, setNewQual] = useState('');
    const [newCabin, setNewCabin] = useState('Operatory 1');

    const searchId = useId();
    const roleFilterId = useId();
    const fullNameId = useId();
    const roleId = useId();
    const usernameId = useId();
    const emailId = useId();
    const pwId = useId();
    const phoneId = useId();
    const licenseId = useId();
    const specId = useId();
    const qualId = useId();
    const cabinId = useId();

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['systemUsers', roleFilter],
        queryFn: () => usersApi.getUsers(roleFilter !== 'all' ? roleFilter : undefined),
    });

    const createUserMutation = useMutation({
        mutationFn: usersApi.createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
            queryClient.invalidateQueries({ queryKey: ['activeDentists'] });
            setIsCreateModalOpen(false);
            resetForm();
        },
        onError: (err: any) => {
            alert(err.message || 'Failed to create user.');
        },
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
            usersApi.updateUser(id, { is_active }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
            queryClient.invalidateQueries({ queryKey: ['activeDentists'] });
        },
    });

    const resetForm = () => {
        setNewEmail('');
        setNewUsername('');
        setNewPassword('');
        setNewFullName('');
        setNewRole('doctor');
        setNewPhone('');
        setNewLicense('');
        setNewSpec('');
        setNewQual('');
        setNewCabin('Operatory 1');
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isClinicalDoctor = newRole === 'doctor' || newRole === 'dentist';
        createUserMutation.mutate({
            email: newEmail,
            username: newUsername,
            password: newPassword,
            full_name: newFullName,
            role: newRole,
            phone: newPhone || undefined,
            is_active: true,
            dentist_profile: isClinicalDoctor
                ? {
                    license_number: newLicense || `PGI-${Date.now().toString().slice(-6)}`,
                    specialization: newSpec || 'General Dentistry',
                    qualifications: newQual || 'BDS, MDS',
                    cabin_number: newCabin || 'Operatory 1',
                    is_active: true,
                }
                : undefined,
        });
    };

    const filteredUsers = users.filter((u: User) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const name = (u.full_name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        return name.includes(q) || email.includes(q) || username.includes(q);
    });

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                        <Shield className="w-3 h-3 mr-1" aria-hidden="true" /> Administrator
                    </span>
                );
            case 'doctor':
            case 'dentist':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800">
                        <Stethoscope className="w-3 h-3 mr-1" aria-hidden="true" /> Doctor
                    </span>
                );
            case 'student':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                        <GraduationCap className="w-3 h-3 mr-1" aria-hidden="true" /> Student
                    </span>
                );
            case 'receptionist':
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                        <UsersIcon className="w-3 h-3 mr-1" aria-hidden="true" /> Attendance Desk
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                        {role}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        PGI Staff & User Accounts
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage faculty doctors, trainee students, attendance receptionists, and system administrators.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl shadow-sm hover:bg-teal-700 transition self-start sm:self-auto"
                >
                    <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
                    Add Staff Member
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <label htmlFor={searchId} className="visually-hidden">
                            Search staff by name or email
                        </label>
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                        <input
                            id={searchId}
                            type="search"
                            placeholder="Search staff by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <label htmlFor={roleFilterId} className="text-xs font-medium text-slate-500">
                            Role:
                        </label>
                        <select
                            id={roleFilterId}
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="all">All Roles</option>
                            <option value="doctor">Doctors</option>
                            <option value="student">Students</option>
                            <option value="receptionist">Receptionists (Attendance)</option>
                            <option value="admin">Administrators</option>
                            <option value="patient">Patients</option>
                        </select>
                    </div>
                </div>

                <div className="text-xs text-slate-500 font-medium">{filteredUsers.length} accounts</div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="py-16 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-teal-600 border-t-transparent" />
                        <p className="text-sm text-slate-500 mt-3 font-medium">Loading staff accounts...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="py-16 text-center">
                        <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
                        <p className="text-base font-semibold text-slate-700">No staff members found</p>
                    </div>
                ) : (
                    <div tabIndex={0} role="region" aria-label="Staff accounts table" className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <caption className="visually-hidden">PGI Dental staff and user accounts</caption>
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    <th scope="col" className="py-3 px-4">Name & Username</th>
                                    <th scope="col" className="py-3 px-4">Contact</th>
                                    <th scope="col" className="py-3 px-4">Role</th>
                                    <th scope="col" className="py-3 px-4">Clinical Profile</th>
                                    <th scope="col" className="py-3 px-4">Account Status</th>
                                    <th scope="col" className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map((u: User) => (
                                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-3.5 px-4">
                                            <div className="font-semibold text-slate-900">{u.full_name}</div>
                                            <div className="text-xs text-slate-500 font-mono">@{u.username}</div>
                                        </td>
                                        <td className="py-3.5 px-4 text-xs text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                                {u.email}
                                            </div>
                                            {u.phone && (
                                                <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                                                    <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                                    {u.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap">{getRoleBadge(u.role)}</td>
                                        <td className="py-3.5 px-4 text-xs text-slate-600">
                                            {u.dentist_profile ? (
                                                <div>
                                                    <div className="font-medium text-slate-800">{u.dentist_profile.specialization}</div>
                                                    <div className="text-slate-500 text-[11px]">
                                                        Lic: {u.dentist_profile.license_number} |{' '}
                                                        {u.dentist_profile.cabin_operatory || u.dentist_profile.cabin_number || 'Operatory 1'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">N/A</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            {u.is_active ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                    <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                                                    <XCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Suspended
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                            {u.id !== currentUser?.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleActiveMutation.mutate({ id: u.id, is_active: !u.is_active })}
                                                    className={`text-xs font-semibold px-2.5 py-1 rounded transition ${u.is_active
                                                            ? 'text-rose-600 hover:bg-rose-50'
                                                            : 'text-emerald-600 hover:bg-emerald-50'
                                                        }`}
                                                >
                                                    {u.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Staff Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Add PGI Clinic Staff Member"
                subtitle="Create credentials and assign role-based permissions"
                icon={<UserPlus className="w-4 h-4" aria-hidden="true" />}
                maxWidthClass="max-w-xl"
            >
                <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={fullNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Full Name *
                            </label>
                            <input
                                id={fullNameId}
                                type="text"
                                required
                                autoFocus
                                value={newFullName}
                                onChange={(e) => setNewFullName(e.target.value)}
                                placeholder="e.g. Dr. Ananya Mehta"
                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        <div>
                            <label htmlFor={roleId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Role *
                            </label>
                            <select
                                id={roleId}
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as Role)}
                                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="doctor">Doctor (Clinical)</option>
                                <option value="student">Student Trainee</option>
                                <option value="receptionist">Receptionist (Attendance Only)</option>
                                <option value="admin">Administrator (Full Access)</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor={usernameId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Username *
                            </label>
                            <input
                                id={usernameId}
                                type="text"
                                required
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="e.g. dr.mehta"
                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        <div>
                            <label htmlFor={emailId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Email Address *
                            </label>
                            <input
                                id={emailId}
                                type="email"
                                required
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="e.g. dr.mehta@pgi.edu.in"
                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        <div>
                            <label htmlFor={pwId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Initial Password *
                            </label>
                            <input
                                id={pwId}
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 8 characters"
                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        <div>
                            <label htmlFor={phoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Phone Number
                            </label>
                            <input
                                id={phoneId}
                                type="tel"
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>

                    {(newRole === 'doctor' || newRole === 'dentist') && (
                        <div className="pt-4 border-t border-slate-200">
                            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                                Doctor Professional Details
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor={licenseId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Dental License #
                                    </label>
                                    <input
                                        id={licenseId}
                                        type="text"
                                        value={newLicense}
                                        onChange={(e) => setNewLicense(e.target.value)}
                                        placeholder="e.g. PGI-98231"
                                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={specId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Specialization
                                    </label>
                                    <input
                                        id={specId}
                                        type="text"
                                        value={newSpec}
                                        onChange={(e) => setNewSpec(e.target.value)}
                                        placeholder="e.g. Orthodontics"
                                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={qualId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Qualifications
                                    </label>
                                    <input
                                        id={qualId}
                                        type="text"
                                        value={newQual}
                                        onChange={(e) => setNewQual(e.target.value)}
                                        placeholder="e.g. BDS, MDS"
                                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={cabinId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Operatory / Cabin
                                    </label>
                                    <input
                                        id={cabinId}
                                        type="text"
                                        value={newCabin}
                                        onChange={(e) => setNewCabin(e.target.value)}
                                        placeholder="e.g. Operatory 2"
                                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createUserMutation.isPending}
                            className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
                        >
                            {createUserMutation.isPending ? 'Saving...' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
