import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Edit2,
  Users,
  Building,
  Award,
  Phone,
  Mail,
  Shield,
  Trash2,
  Stethoscope
} from 'lucide-react';
import { studentsApi } from '../api/students';
import { doctorsApi } from '../api/doctors';
import { useAuth } from '../context/AuthContext';
import { Student } from '../types';

export default function Students() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form states
  const [studentName, setStudentName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [college, setCollege] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | undefined>(undefined);
  const [accountStatus, setAccountStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isDoctor = user?.role === 'dentist' || user?.role === 'doctor';

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['studentsList', search],
    queryFn: () => studentsApi.list(search || undefined),
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctorsListForStudentCreate'],
    queryFn: () => doctorsApi.list(),
    enabled: isAdmin
  });

  const createMutation = useMutation({
    mutationFn: studentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentsList'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create student');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => studentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentsList'] });
      setEditingStudent(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to update student');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: studentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentsList'] });
    }
  });

  const resetForm = () => {
    setStudentName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setCollege('');
    setEnrollmentNumber('');
    setSelectedDoctorId(undefined);
    setAccountStatus('active');
    setFormError(null);
  };

  const handleOpenEdit = (stu: Student) => {
    setEditingStudent(stu);
    setStudentName(stu.student_name);
    setEmail(stu.email);
    setPassword('');
    setPhone(stu.phone_number || '');
    setCollege(stu.college_institution);
    setEnrollmentNumber(stu.enrollment_number);
    setSelectedDoctorId(stu.doctor_id);
    setAccountStatus(stu.account_status as any);
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !email || !password || !college || !enrollmentNumber) {
      setFormError('Please fill all mandatory fields (Name, Email, Password, College, Enrollment No).');
      return;
    }
    if (isAdmin && !selectedDoctorId) {
      setFormError('Please select a supervising doctor for this student.');
      return;
    }
    createMutation.mutate({
      student_name: studentName,
      email,
      password,
      phone_number: phone || undefined,
      college_institution: college,
      enrollment_number: enrollmentNumber,
      doctor_id: selectedDoctorId,
      account_status: accountStatus
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const payload: any = {
      student_name: studentName,
      email,
      phone_number: phone || undefined,
      college_institution: college,
      enrollment_number: enrollmentNumber,
      account_status: accountStatus
    };
    if (password) {
      payload.password = password;
    }
    updateMutation.mutate({ id: editingStudent.id, data: payload });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {isDoctor ? 'My Supervised Students' : 'Students Management'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDoctor
                ? 'Register and supervise dental students assigned under your clinical direction.'
                : 'Manage academic dental students registered across all clinic departments.'}
            </p>
          </div>
        </div>

        {(isDoctor || isAdmin) && (
          <button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Student</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, email, enrollment number, or college..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
        </div>
      </div>

      {/* Students Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          Loading students...
        </div>
      ) : students.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          No students registered yet. Click "Register New Student" to enroll a clinical trainee.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {students.map((stu) => (
            <div
              key={stu.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-teal-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold text-sm">
                      {stu.student_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{stu.student_name}</h3>
                      <p className="text-[11px] font-semibold text-slate-500">{stu.college_institution}</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      stu.account_status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {stu.account_status === 'active' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {stu.account_status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px] text-slate-700 font-semibold">Enrollment: {stu.enrollment_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="font-semibold text-teal-800">
                      Supervising: {stu.doctor_name || `Doctor #${stu.doctor_id}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{stu.email}</span>
                  </div>
                  {stu.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{stu.phone_number}</span>
                    </div>
                  )}
                </div>

                {/* Assigned Patients Count */}
                <div className="mt-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                  <div className="text-sm font-black text-slate-800">{stu.patients_count ?? 0}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Assigned Patients</div>
                </div>
              </div>

              {/* Action Buttons */}
              {(isDoctor || isAdmin) && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEdit(stu)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  {stu.account_status === 'active' && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Deactivate student ${stu.student_name}?`)) {
                          deleteMutation.mutate(stu.id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Deactivate</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreateModalOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {editingStudent ? 'Edit Student Profile' : 'Register New Student'}
              </h2>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingStudent(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={editingStudent ? handleUpdateSubmit : handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="student@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingStudent ? 'New Password (Optional)' : 'Password *'}
                  </label>
                  <input
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 00501"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment / Roll No. *</label>
                  <input
                    type="text"
                    required
                    placeholder="ENR-2026-0042"
                    value={enrollmentNumber}
                    onChange={(e) => setEnrollmentNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">College / Dental Institution *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Institute of Dental Sciences"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {isAdmin && !editingStudent && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supervising Doctor *</label>
                  <select
                    value={selectedDoctorId || ''}
                    onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="">-- Assign Responsible Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.doctor_name} ({d.specialization})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                <select
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
          </div>
        </div>
      )}
    </div>
  );
}
