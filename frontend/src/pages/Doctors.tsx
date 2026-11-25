import React, { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stethoscope,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Edit2,
  Award,
  Phone,
  Mail,
  Shield,
  Trash2,
  Building2,
  ShieldCheck,
  DoorOpen,
} from 'lucide-react';
import { doctorsApi } from '../api/doctors';
import { Doctor } from '../types';
import Modal from '../components/common/Modal';

const PGI_DEPARTMENTS = [
  'Oral Health Sciences — General',
  'Conservative Dentistry & Endodontics',
  'Periodontology & Oral Implantology',
  'Oral & Maxillofacial Surgery',
  'Prosthodontics & Crown Bridge',
  'Orthodontics & Dentofacial Orthopedics',
  'Pediatric & Preventive Dentistry',
  'Oral Medicine & Radiology',
];

const OPERATORIES = ['Operatory 1', 'Operatory 2', 'Operatory 3', 'Operatory 4', 'OT / Surgical Suite'];

export default function Doctors() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  const [doctorName, setDoctorName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('General Dentistry');
  const [department, setDepartment] = useState(PGI_DEPARTMENTS[0]);
  const [cabinOperatory, setCabinOperatory] = useState('Operatory 1');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isAdminFaculty, setIsAdminFaculty] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);

  const searchInputId = useId();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const phoneId = useId();
  const licenseId = useId();
  const specId = useId();
  const qualId = useId();
  const deptId = useId();
  const operatoryId = useId();
  const isAdminId = useId();
  const statusId = useId();

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctorsList', search],
    queryFn: () => doctorsApi.list(search || undefined),
  });

  const createMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorsList'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create doctor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => doctorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorsList'] });
      setEditingDoctor(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to update doctor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: doctorsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorsList'] });
    },
  });

  const resetForm = () => {
    setDoctorName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setQualification('');
    setSpecialization('General Dentistry');
    setDepartment(PGI_DEPARTMENTS[0]);
    setCabinOperatory('Operatory 1');
    setLicenseNumber('');
    setIsAdminFaculty(false);
    setAccountStatus('active');
    setFormError(null);
  };

  const handleOpenEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setDoctorName(doc.full_name || doc.doctor_name);
    setEmail(doc.email);
    setPassword('');
    setPhone(doc.phone || doc.phone_number || '');
    setQualification(doc.qualification || '');
    setSpecialization(doc.specialization);
    setDepartment(doc.department || PGI_DEPARTMENTS[0]);
    setCabinOperatory(doc.cabin_operatory || 'Operatory 1');
    setLicenseNumber(doc.license_number || doc.registration_number);
    setIsAdminFaculty(Boolean(doc.is_admin));
    const active =
      doc.is_active !== undefined ? (doc.is_active ? 'active' : 'inactive') : doc.account_status;
    setAccountStatus((active as 'active' | 'inactive') || 'active');
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName || !email || !password || !licenseNumber) {
      setFormError('Please fill all mandatory fields (Name, Email, Password, License No).');
      return;
    }
    createMutation.mutate({
      doctor_name: doctorName,
      full_name: doctorName,
      email,
      password,
      phone_number: phone || undefined,
      phone: phone || undefined,
      qualification: qualification || undefined,
      specialization,
      department,
      cabin_operatory: cabinOperatory,
      registration_number: licenseNumber,
      license_number: licenseNumber,
      is_admin: isAdminFaculty,
      account_status: accountStatus,
      is_active: accountStatus === 'active',
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    const payload: any = {
      doctor_name: doctorName,
      full_name: doctorName,
      email,
      phone_number: phone || undefined,
      phone: phone || undefined,
      qualification: qualification || undefined,
      specialization,
      department,
      cabin_operatory: cabinOperatory,
      registration_number: licenseNumber,
      license_number: licenseNumber,
      is_admin: isAdminFaculty,
      account_status: accountStatus,
      is_active: accountStatus === 'active',
    };
    if (password) {
      payload.password = password;
    }
    updateMutation.mutate({ id: editingDoctor.id, data: payload });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              PGI Dental Faculty & Doctors
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage dental specialists, operatory assignments, departments, and Designated Faculty Admin privileges.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Register New Doctor</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <search className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <label htmlFor={searchInputId} className="visually-hidden">
          Search doctors by name, email, department, specialization, or license number
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            id={searchInputId}
            type="search"
            placeholder="Search by doctor name, email, department, specialization, or license no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
        </div>
      </search>

      {/* Doctors Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200">
          Loading doctors roster...
        </div>
      ) : doctors.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200">
          No doctors found. Click "Register New Doctor" to add the first faculty member.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {doctors.map((doc) => {
            const displayName = doc.full_name || doc.doctor_name;
            const displayLicense = doc.license_number || doc.registration_number;
            const displayPhone = doc.phone || doc.phone_number;
            const isActive =
              doc.is_active !== undefined ? doc.is_active : doc.account_status === 'active';

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-teal-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {displayName.replace('Dr. ', '').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-slate-900 truncate">{displayName}</h2>
                        <p className="text-[11px] font-semibold text-teal-700 truncate">
                          {doc.specialization}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isActive ? (
                          <CheckCircle className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <XCircle className="w-3 h-3" aria-hidden="true" />
                        )}
                        {isActive ? 'active' : 'inactive'}
                      </span>

                      {doc.is_admin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                          Designated Faculty Admin
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate font-medium text-slate-700">
                        {doc.department || 'Oral Health Sciences Centre'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-teal-800">
                        {doc.cabin_operatory || 'Operatory 1'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{doc.qualification || 'BDS, MDS'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="font-mono text-[11px] text-slate-700 font-semibold">
                        {displayLicense}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{doc.email}</span>
                    </div>
                    {displayPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>{displayPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* Subordinate Counts */}
                  <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                    <div>
                      <div className="text-sm font-black text-slate-800">{doc.students_count ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Mentored Students</div>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-800">{doc.patients_count ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Patients</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(doc)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Deactivate ${displayName}?`)) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Deactivate</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen || !!editingDoctor}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingDoctor(null);
        }}
        title={editingDoctor ? 'Edit PGI Doctor Profile' : 'Register New PGI Doctor'}
        subtitle="Faculty specialist details, operatory cabin & Admin designation"
        icon={<Stethoscope className="w-4 h-4" aria-hidden="true" />}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={editingDoctor ? handleUpdateSubmit : handleCreateSubmit} className="p-6 space-y-4">
          {formError && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor={nameId} className="block text-xs font-semibold text-slate-700 mb-1">
              Doctor Full Name *
            </label>
            <input
              id={nameId}
              type="text"
              required
              autoFocus
              placeholder="e.g. Dr. Ananya Mehta"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
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
                placeholder="dr.mehta@pgi.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor={passwordId} className="block text-xs font-semibold text-slate-700 mb-1">
                {editingDoctor ? 'New Password (Optional)' : 'Password *'}
              </label>
              <input
                id={passwordId}
                type="password"
                required={!editingDoctor}
                placeholder={editingDoctor ? 'Leave blank to keep' : 'Minimum 6 chars'}
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
                placeholder="+91 98765 00201"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor={licenseId} className="block text-xs font-semibold text-slate-700 mb-1">
                License / Registration No. *
              </label>
              <input
                id={licenseId}
                type="text"
                required
                placeholder="PGI-DENT-88231"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={deptId} className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <select
                id={deptId}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {PGI_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={operatoryId} className="block text-xs font-semibold text-slate-700 mb-1">
                Cabin / Operatory
              </label>
              <select
                id={operatoryId}
                value={cabinOperatory}
                onChange={(e) => setCabinOperatory(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {OPERATORIES.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={specId} className="block text-xs font-semibold text-slate-700 mb-1">
                Specialization
              </label>
              <input
                id={specId}
                type="text"
                placeholder="e.g. Endodontics"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor={qualId} className="block text-xs font-semibold text-slate-700 mb-1">
                Qualifications
              </label>
              <input
                id={qualId}
                type="text"
                placeholder="e.g. BDS, MDS (Endo)"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-start gap-2.5">
            <input
              id={isAdminId}
              type="checkbox"
              checked={isAdminFaculty}
              onChange={(e) => setIsAdminFaculty(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor={isAdminId} className="text-xs text-purple-900 cursor-pointer">
              <span className="font-bold block">Designated Faculty Admin</span>
              <span className="text-[11px] text-purple-700">
                Grants full administrative permissions (doctors, student access revocation, clinic settings, audit logs).
              </span>
            </label>
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
              <option value="active">Active (Permitted to log in and manage patients)</option>
              <option value="inactive">Inactive (Suspended)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingDoctor(null);
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
                : editingDoctor
                ? 'Update Doctor'
                : 'Save & Register Doctor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
