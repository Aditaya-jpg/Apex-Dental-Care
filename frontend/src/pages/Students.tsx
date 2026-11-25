import React, { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    GraduationCap,
    Plus,
    Search,
    CheckCircle,
    XCircle,
    Edit2,
    Phone,
    Mail,
    Shield,
    UserX,
    Stethoscope,
    AlertTriangle,
    Users,
    Building2,
} from 'lucide-react';
import { studentsApi } from '../api/students';
import { doctorsApi } from '../api/doctors';
import { useAuth } from '../context/AuthContext';
import { Student } from '../types';
import Modal from '../components/common/Modal';

export default function Students() {
    const { user, hasRole } = useAuth();
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [revokeEmailInput, setRevokeEmailInput] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [revokingStudent, setRevokingStudent] = useState<Student | null>(null);
    const [confirmRevokeEmail, setConfirmRevokeEmail] = useState<string | null>(null);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form states
    const [studentName, setStudentName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [college, setCollege] = useState('Oral Health Sciences Centre, PGIMER Chandigarh');
    const [rollNumber, setRollNumber] = useState('');
    const [yearOfStudy, setYearOfStudy] = useState('MDS / Intern');
    const [department, setDepartment] = useState('Oral Health Sciences');
    const [selectedDoctorId, setSelectedDoctorId] = useState<number | ''>('');
    const [accountStatus, setAccountStatus] = useState<'active' | 'inactive'>('active');
    const [formError, setFormError] = useState<string | null>(null);

    const searchId = useId();
    const revokeEmailId = useId();
    const nameId = useId();
    const emailId = useId();
    const pwId = useId();
    const phoneId = useId();
    const rollId = useId();
    const yearId = useId();
    const deptId = useId();
    const collegeId = useId();
    const mentorId = useId();
    const statusId = useId();

    const isAdmin = user?.role === 'admin' || user?.is_admin === true;
    const isDoctorOrAdmin = hasRole('admin', 'doctor', 'dentist');

    const { data: students = [], isLoading } = useQuery({
        queryKey: ['studentsList', search],
        queryFn: () => studentsApi.list(search || undefined),
    });

    const { data: doctors = [] } = useQuery({
        queryKey: ['doctorsListForStudentPool'],
        queryFn: () => doctorsApi.list(),
        enabled: isDoctorOrAdmin,
    });

    const createMutation = useMutation({
        mutationFn: studentsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentsList'] });
            setIsCreateModalOpen(false);
            resetForm();
            setActionFeedback({ type: 'success', text: 'Student enrolled in unified PGI Dental pool.' });
        },
        onError: (err: any) => {
            setFormError(err.message || 'Failed to register student');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => studentsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studentsList'] });
            setEditingStudent(null);
            resetForm();
            setActionFeedback({ type: 'success', text: 'Student profile updated.' });
        },
        onError: (err: any) => {
            setFormError(err.message || 'Failed to update student');
        },
    });

    const revokeByIdMutation = useMutation({
        mutationFn: (id: number) => studentsApi.delete(id),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['studentsList'] });
            setRevokingStudent(null);
            setActionFeedback({
                type: 'success',
                text: res?.message || 'Student access revoked immediately; assigned patient records preserved.',
            });
        },
        onError: (err: any) => {
            setActionFeedback({ type: 'error', text: err.message || 'Failed to revoke student access.' });
        },
    });

    const revokeByEmailMutation = useMutation({
        mutationFn: (targetEmail: string) => studentsApi.revokeByEmail(targetEmail),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['studentsList'] });
            setConfirmRevokeEmail(null);
            setRevokeEmailInput('');
            setActionFeedback({
                type: 'success',
                text: res?.message || 'Student access revoked by email immediately; patient records preserved.',
            });
        },
        onError: (err: any) => {
            setActionFeedback({ type: 'error', text: err.message || 'Could not revoke student by email.' });
        },
    });

    const resetForm = () => {
        setStudentName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setCollege('Oral Health Sciences Centre, PGIMER Chandigarh');
        setRollNumber('');
        setYearOfStudy('MDS / Intern');
        setDepartment('Oral Health Sciences');
        setSelectedDoctorId('');
        setAccountStatus('active');
        setFormError(null);
    };

    const handleOpenEdit = (stu: Student) => {
        setEditingStudent(stu);
        setStudentName(stu.full_name || stu.student_name);
        setEmail(stu.email);
        setPassword('');
        setPhone(stu.phone || stu.phone_number || '');
        setCollege(stu.college_institution || 'Oral Health Sciences Centre, PGIMER Chandigarh');
        setRollNumber(stu.roll_number || stu.enrollment_number);
        setYearOfStudy(stu.year_of_study || 'MDS / Intern');
        setDepartment(stu.department || 'Oral Health Sciences');
        setSelectedDoctorId(stu.doctor_id ?? '');
        const active =
            stu.is_active !== undefined ? (stu.is_active ? 'active' : 'inactive') : stu.account_status;
        setAccountStatus((active as 'active' | 'inactive') || 'active');
        setFormError(null);
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName || !email || !password || !rollNumber) {
            setFormError('Please fill all mandatory fields (Name, Email, Password, Roll / Enrollment No).');
            return;
        }
        createMutation.mutate({
            student_name: studentName,
            full_name: studentName,
            email,
            password,
            phone_number: phone || undefined,
            phone: phone || undefined,
            college_institution: college || 'Oral Health Sciences Centre, PGIMER Chandigarh',
            enrollment_number: rollNumber,
            roll_number: rollNumber,
            year_of_study: yearOfStudy || undefined,
            department: department || undefined,
            doctor_id: selectedDoctorId ? Number(selectedDoctorId) : null,
            account_status: accountStatus,
            is_active: accountStatus === 'active',
        });
    };

    const handleUpdateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStudent) return;
        const payload: any = {
            student_name: studentName,
            full_name: studentName,
            email,
            phone_number: phone || undefined,
            phone: phone || undefined,
            college_institution: college || undefined,
            enrollment_number: rollNumber,
            roll_number: rollNumber,
            year_of_study: yearOfStudy || undefined,
            department: department || undefined,
            doctor_id: selectedDoctorId ? Number(selectedDoctorId) : null,
            account_status: accountStatus,
            is_active: accountStatus === 'active',
        };
        if (password) {
            payload.password = password;
        }
        updateMutation.mutate({ id: editingStudent.id, data: payload });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                            PGI Dental Students Roster
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Unified branch trainee pool. Optional faculty mentor assignment; instant session revocation supported.
                        </p>
                    </div>
                </div>

                {isDoctorOrAdmin && (
                    <button
                        type="button"
                        onClick={() => {
                            resetForm();
                            setIsCreateModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>Register New Student</span>
                    </button>
                )}
            </div>

            {actionFeedback && (
                <div
                    role={actionFeedback.type === 'error' ? 'alert' : 'status'}
                    className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${actionFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                >
                    <span>{actionFeedback.text}</span>
                    <button
                        type="button"
                        onClick={() => setActionFeedback(null)}
                        className="underline text-[11px]"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Search & Quick Revoke by Email Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
                <search className="relative flex-1">
                    <label htmlFor={searchId} className="visually-hidden">
                        Search students by name, email, roll number, or department
                    </label>
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                        id={searchId}
                        type="search"
                        placeholder="Search by student name, email, roll / enrollment number, or department..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    />
                </search>

                {isAdmin && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 lg:pt-0 lg:pl-3 lg:border-l border-slate-200">
                        <label htmlFor={revokeEmailId} className="visually-hidden">
                            Quick revoke student access by email
                        </label>
                        <input
                            id={revokeEmailId}
                            type="email"
                            placeholder="Revoke access by student email..."
                            value={revokeEmailInput}
                            onChange={(e) => setRevokeEmailInput(e.target.value)}
                            className="px-3 py-2 bg-rose-50/40 border border-rose-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 sm:w-64"
                        />
                        <button
                            type="button"
                            disabled={!revokeEmailInput.trim()}
                            onClick={() => setConfirmRevokeEmail(revokeEmailInput.trim())}
                            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                        >
                            <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Revoke by Email</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Students Grid */}
            {isLoading ? (
                <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200">
                    Loading unified PGI Dental student roster...
                </div>
            ) : students.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200">
                    No students registered yet. Click "Register New Student" to enroll a clinical trainee.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {students.map((stu) => {
                        const displayName = stu.full_name || stu.student_name;
                        const displayRoll = stu.roll_number || stu.enrollment_number;
                        const displayPhone = stu.phone || stu.phone_number;
                        const isActive =
                            stu.is_active !== undefined ? stu.is_active : stu.account_status === 'active';

                        return (
                            <div
                                key={stu.id}
                                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-teal-300 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                {displayName.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="text-sm font-bold text-slate-900 truncate">{displayName}</h2>
                                                <p className="text-[11px] font-semibold text-slate-500 truncate">
                                                    {stu.year_of_study || 'Dental Trainee'} • {stu.department || 'PGI Dental'}
                                                </p>
                                            </div>
                                        </div>

                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${isActive
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}
                                        >
                                            {isActive ? (
                                                <CheckCircle className="w-3 h-3" aria-hidden="true" />
                                            ) : (
                                                <XCircle className="w-3 h-3" aria-hidden="true" />
                                            )}
                                            {isActive ? 'active' : 'revoked'}
                                        </span>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                            <span className="font-mono text-[11px] text-slate-700 font-semibold">
                                                Roll No: {displayRoll}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" aria-hidden="true" />
                                            <span className="font-semibold text-teal-800 truncate">
                                                Mentor:{' '}
                                                {stu.doctor_name
                                                    ? stu.doctor_name
                                                    : stu.doctor_id
                                                        ? `Doctor #${stu.doctor_id}`
                                                        : 'Unassigned / Branch Pool'}
                                            </span>
                                        </div>
                                        {stu.college_institution && (
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                                <span className="truncate">{stu.college_institution}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                            <span className="truncate">{stu.email}</span>
                                        </div>
                                        {displayPhone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                                <span>{displayPhone}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Assigned Patients Count Badge */}
                                    <div className="mt-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between px-4">
                                        <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
                                            Assigned Patients
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-black">
                                            {stu.patients_count ?? 0}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                {isDoctorOrAdmin && (
                                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(stu)}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Edit</span>
                                        </button>
                                        {isActive && (
                                            <button
                                                type="button"
                                                onClick={() => setRevokingStudent(stu)}
                                                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition"
                                            >
                                                <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>Remove & Revoke Access</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Modal */}
            <Modal
                isOpen={isCreateModalOpen || !!editingStudent}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingStudent(null);
                }}
                title={editingStudent ? 'Edit Student Profile' : 'Register New Student'}
                subtitle="PGI Dental unified trainee pool (mentor assignment optional)"
                icon={<GraduationCap className="w-4 h-4" aria-hidden="true" />}
                maxWidthClass="max-w-lg"
            >
                <form onSubmit={editingStudent ? handleUpdateSubmit : handleCreateSubmit} className="p-6 space-y-4">
                    {formError && (
                        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                            {formError}
                        </div>
                    )}

                    <div>
                        <label htmlFor={nameId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Student Full Name *
                        </label>
                        <input
                            id={nameId}
                            type="text"
                            required
                            autoFocus
                            placeholder="e.g. Dr. Rohan Verma (PG Trainee)"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={emailId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Email Address *
                            </label>
                            <input
                                id={emailId}
                                type="email"
                                required
                                placeholder="student1@pgi.edu.in"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label htmlFor={pwId} className="block text-xs font-semibold text-slate-700 mb-1">
                                {editingStudent ? 'New Password (Optional)' : 'Password *'}
                            </label>
                            <input
                                id={pwId}
                                type="password"
                                required={!editingStudent}
                                placeholder={editingStudent ? 'Leave blank to keep' : 'Minimum 6 chars'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={phoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Phone Number
                            </label>
                            <input
                                id={phoneId}
                                type="tel"
                                placeholder="+91 98765 00501"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label htmlFor={rollId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Roll / Enrollment No. *
                            </label>
                            <input
                                id={rollId}
                                type="text"
                                required
                                placeholder="PGI-MDS-2026-01"
                                value={rollNumber}
                                onChange={(e) => setRollNumber(e.target.value)}
                                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={yearId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Year / Program
                            </label>
                            <input
                                id={yearId}
                                type="text"
                                placeholder="e.g. MDS Year 2"
                                value={yearOfStudy}
                                onChange={(e) => setYearOfStudy(e.target.value)}
                                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label htmlFor={deptId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Department
                            </label>
                            <input
                                id={deptId}
                                type="text"
                                placeholder="e.g. Oral Health Sciences"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor={collegeId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Dental Institution
                        </label>
                        <input
                            id={collegeId}
                            type="text"
                            placeholder="Oral Health Sciences Centre, PGIMER Chandigarh"
                            value={college}
                            onChange={(e) => setCollege(e.target.value)}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label htmlFor={mentorId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Supervising Mentor (Optional)
                        </label>
                        <select
                            id={mentorId}
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        >
                            <option value="">Unassigned / Branch Pool (Any Doctor Can Supervise)</option>
                            {doctors.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.full_name || d.doctor_name} ({d.specialization})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor={statusId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Account Status
                        </label>
                        <select
                            id={statusId}
                            value={accountStatus}
                            onChange={(e) => setAccountStatus(e.target.value as any)}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        >
                            <option value="active">Active (Permitted to view and update assigned records)</option>
                            <option value="inactive">Inactive (Suspended)</option>
                        </select>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreateModalOpen(false);
                                setEditingStudent(null);
                            }}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                        >
                            {createMutation.isPending || updateMutation.isPending
                                ? 'Saving...'
                                : editingStudent
                                    ? 'Update Student'
                                    : 'Save & Register Student'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Confirmation Modal: Remove & Revoke Access (by ID) */}
            <Modal
                isOpen={!!revokingStudent}
                onClose={() => setRevokingStudent(null)}
                title="Remove & Revoke Student Access?"
                subtitle={revokingStudent ? `${revokingStudent.full_name || revokingStudent.student_name} (${revokingStudent.email})` : ''}
                icon={<AlertTriangle className="w-4 h-4 text-rose-600" aria-hidden="true" />}
                maxWidthClass="max-w-md"
            >
                {revokingStudent && (
                    <div className="p-6 space-y-4">
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
                            <p className="font-bold">Immediate Security & Data Preservation Impact:</p>
                            <ul className="list-disc pl-4 space-y-1 text-rose-800">
                                <li>
                                    All active JWT access & refresh tokens for <strong>{revokingStudent.email}</strong> are revoked immediately (`401 Unauthorized` on next API call).
                                </li>
                                <li>
                                    Login is permanently blocked and the student is removed from active clinic access.
                                </li>
                                <li>
                                    All <strong>{revokingStudent.patients_count ?? 0}</strong> assigned patient medical records remain safely preserved (`student_id` unlinked to branch pool).
                                </li>
                            </ul>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setRevokingStudent(null)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={revokeByIdMutation.isPending}
                                onClick={() => revokeByIdMutation.mutate(revokingStudent.id)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                {revokeByIdMutation.isPending ? 'Revoking...' : 'Confirm Revoke Access'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmation Modal: Revoke by Email */}
            <Modal
                isOpen={!!confirmRevokeEmail}
                onClose={() => setConfirmRevokeEmail(null)}
                title="Revoke Student Access by Email?"
                subtitle={confirmRevokeEmail || ''}
                icon={<AlertTriangle className="w-4 h-4 text-rose-600" aria-hidden="true" />}
                maxWidthClass="max-w-md"
            >
                {confirmRevokeEmail && (
                    <div className="p-6 space-y-4">
                        <p className="text-xs text-slate-700 leading-relaxed">
                            This will immediately revoke all active JWT sessions and login access for{' '}
                            <strong className="font-mono text-rose-700">{confirmRevokeEmail}</strong> while preserving all patient EMR records safely.
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setConfirmRevokeEmail(null)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={revokeByEmailMutation.isPending}
                                onClick={() => revokeByEmailMutation.mutate(confirmRevokeEmail)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                            >
                                {revokeByEmailMutation.isPending ? 'Revoking...' : 'Revoke Access Now'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
