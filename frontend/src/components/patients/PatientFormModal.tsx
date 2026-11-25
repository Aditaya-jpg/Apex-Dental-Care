import React, { useState, useEffect, useId } from 'react';
import {
  UserPlus,
  Plus,
  X,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { Doctor, LanguageCode, Patient, Student } from '../../types';
import { studentsApi } from '../../api/students';
import { doctorsApi } from '../../api/doctors';
import { patientsApi } from '../../api/patients';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  initialData?: Patient | null;
}

export const DISEASE_OPTIONS = [
  'Dental Caries',
  'Gingivitis',
  'Periodontitis',
  'Pulpitis',
  'Dental Abscess',
  'Tooth Fracture',
  'Malocclusion',
  'Tooth Sensitivity',
  'Missing Teeth',
  'Oral Lesions',
  'Impacted Tooth',
  'Other',
];

const PRESET_KEYWORDS = [
  'Pediatric (<18)',
  'Geriatric (60+)',
  'Special Case',
  'Medically Compromised',
  'Pregnant',
  'Emergency',
];

export const PatientFormModal: React.FC<PatientFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const { user, hasRole } = useAuth();
  const isDoctorOrAdmin = hasRole('admin', 'doctor', 'dentist');

  const splitNames = (pat?: Patient | null) => {
    if (!pat) return { first: '', last: '' };
    if (pat.first_name || pat.last_name) {
      return { first: pat.first_name || '', last: pat.last_name || '' };
    }
    const parts = (pat.full_name || pat.patient_name || '').trim().split(/\s+/);
    return {
      first: parts[0] || '',
      last: parts.slice(1).join(' ') || '',
    };
  };

  const initialNames = splitNames(initialData);

  const [firstName, setFirstName] = useState(initialNames.first);
  const [lastName, setLastName] = useState(initialNames.last);
  const [dob, setDob] = useState(initialData?.date_of_birth || '1995-01-01');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(initialData?.gender || 'Male');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [emergencyContactName, setEmergencyContactName] = useState(
    initialData?.emergency_contact_name || initialData?.emergency_contact || ''
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initialData?.emergency_contact_phone || ''
  );
  const [bloodGroup, setBloodGroup] = useState(initialData?.blood_group || 'O+');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>(
    initialData?.preferred_language || 'en'
  );

  // Clinical, CR, Assignment & Keywords
  const [crNumber, setCrNumber] = useState(initialData?.cr_number || '');
  const [doctorId, setDoctorId] = useState<number | ''>(initialData?.doctor_id || '');
  const [studentId, setStudentId] = useState<number | ''>(initialData?.student_id || '');
  const [diseaseCategories, setDiseaseCategories] = useState<string[]>(
    initialData?.disease_categories || []
  );
  const [specialCaseFlag, setSpecialCaseFlag] = useState<boolean>(
    Boolean(initialData?.special_case_flag)
  );
  const [caseKeywords, setCaseKeywords] = useState<string[]>(initialData?.case_keywords || []);
  const [customKeyword, setCustomKeyword] = useState('');
  const [cardFile, setCardFile] = useState<File | null>(null);

  // Parent / Guardian Consent
  const [parentConsentRequired, setParentConsentRequired] = useState<boolean>(
    Boolean(initialData?.parent_consent_required)
  );
  const [parentGuardianName, setParentGuardianName] = useState(
    initialData?.parent_guardian_name || ''
  );
  const [parentGuardianPhone, setParentGuardianPhone] = useState(
    initialData?.parent_guardian_phone || ''
  );
  const [parentConsentStatus, setParentConsentStatus] = useState<
    'not_required' | 'pending' | 'signed'
  >(initialData?.parent_consent_status || 'not_required');
  const [consentFile, setConsentFile] = useState<File | null>(null);

  // Staff pools
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);

  // Medical History
  const [allergies, setAllergies] = useState(initialData?.medical_history?.allergies || '');
  const [medicalConditions, setMedicalConditions] = useState(
    initialData?.medical_history?.medical_conditions || ''
  );
  const [currentMedications, setCurrentMedications] = useState(
    initialData?.medical_history?.current_medications || ''
  );
  const [bleedingDisorders, setBleedingDisorders] = useState(
    initialData?.medical_history?.bleeding_disorders || false
  );

  // Dental History
  const [chiefComplaint, setChiefComplaint] = useState(
    initialData?.dental_history?.chief_complaint || ''
  );
  const [brushingFrequency, setBrushingFrequency] = useState(
    initialData?.dental_history?.brushing_frequency || 'Twice daily'
  );

  const [activeTab, setActiveTab] = useState<
    'demographics' | 'clinical' | 'consent' | 'medical' | 'dental'
  >('demographics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstNameId = useId();
  const lastNameId = useId();
  const dobId = useId();
  const genderId = useId();
  const bloodId = useId();
  const langId = useId();
  const phoneId = useId();
  const emailId = useId();
  const addressId = useId();
  const emerNameId = useId();
  const emerPhoneId = useId();
  const crId = useId();
  const docAssignId = useId();
  const stuAssignId = useId();
  const specialCaseId = useId();
  const customKwId = useId();
  const cardUploadId = useId();
  const consentReqId = useId();
  const guardianNameId = useId();
  const guardianPhoneId = useId();
  const consentStatusId = useId();
  const consentFileId = useId();
  const allergyId = useId();
  const medCondId = useId();
  const currMedId = useId();
  const bleedId = useId();
  const chiefId = useId();
  const brushId = useId();

  useEffect(() => {
    if (!isOpen) return;
    doctorsApi
      .list()
      .then((res) => setAvailableDoctors(res || []))
      .catch(() => setAvailableDoctors([]));
    if (isDoctorOrAdmin) {
      studentsApi
        .list()
        .then((res) => setAvailableStudents(res || []))
        .catch(() => setAvailableStudents([]));
    }
  }, [isOpen, isDoctorOrAdmin]);

  // Calculate age from DOB
  const computedAge = (() => {
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return 25;
    return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
  })();
  const isMinorOrSpecial = computedAge < 18 || specialCaseFlag;

  useEffect(() => {
    if (isMinorOrSpecial && !parentConsentRequired && !initialData) {
      setParentConsentRequired(true);
      if (parentConsentStatus === 'not_required') {
        setParentConsentStatus('pending');
      }
    }
  }, [isMinorOrSpecial]);

  if (!isOpen) return null;

  const toggleDisease = (disease: string) => {
    setDiseaseCategories((prev) =>
      prev.includes(disease) ? prev.filter((d) => d !== disease) : [...prev, disease]
    );
  };

  const toggleKeyword = (kw: string) => {
    setCaseKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  };

  const handleAddCustomKeyword = () => {
    const cleaned = customKeyword.trim();
    if (!cleaned) return;
    if (!caseKeywords.includes(cleaned)) {
      setCaseKeywords((prev) => [...prev, cleaned]);
    }
    setCustomKeyword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !phone.trim() || !dob) {
      setError('Please fill in mandatory demographic fields (First Name, Phone, DOB).');
      setActiveTab('demographics');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const payload: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || '-',
        full_name: fullName,
        date_of_birth: dob,
        age: computedAge,
        gender,
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        emergency_contact: emergencyContactName.trim() || undefined,
        emergency_contact_name: emergencyContactName.trim() || undefined,
        emergency_contact_phone: emergencyContactPhone.trim() || undefined,
        blood_group: bloodGroup || undefined,
        preferred_language: preferredLanguage,
        cr_number: crNumber.trim() || undefined,
        disease_categories: diseaseCategories,
        case_keywords: caseKeywords,
        special_case_flag: specialCaseFlag,
        doctor_id: doctorId ? Number(doctorId) : null,
        student_id: isDoctorOrAdmin ? (studentId ? Number(studentId) : null) : user?.student_id || undefined,
        parent_consent_required: parentConsentRequired,
        parent_guardian_name: parentGuardianName.trim() || undefined,
        parent_guardian_phone: parentGuardianPhone.trim() || undefined,
        parent_consent_status: parentConsentRequired ? parentConsentStatus : 'not_required',
        medical_history: {
          allergies: allergies || undefined,
          medical_conditions: medicalConditions || undefined,
          current_medications: currentMedications || undefined,
          bleeding_disorders: bleedingDisorders,
        },
        dental_history: {
          chief_complaint: chiefComplaint || undefined,
          brushing_frequency: brushingFrequency,
        },
      };

      const result = await onSubmit(payload);
      const savedPatientId = result?.id || initialData?.id;

      if (cardFile && savedPatientId) {
        const cardFd = new FormData();
        cardFd.append('file', cardFile);
        if (crNumber.trim()) cardFd.append('cr_number', crNumber.trim());
        await patientsApi.uploadCard(savedPatientId, cardFd);
      }

      if (consentFile && savedPatientId) {
        const consentFd = new FormData();
        consentFd.append('file', consentFile);
        consentFd.append('parent_guardian_name', parentGuardianName.trim());
        consentFd.append('parent_guardian_phone', parentGuardianPhone.trim());
        consentFd.append('parent_consent_status', parentConsentStatus === 'not_required' ? 'signed' : parentConsentStatus);
        await patientsApi.uploadConsent(savedPatientId, consentFd);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save patient record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'demographics', label: '1. Demographics & Language' },
    { id: 'clinical', label: '2. Categories, CR & Assignment' },
    { id: 'consent', label: isMinorOrSpecial ? '3. Parent Consent (!)' : '3. Parent Consent' },
    { id: 'medical', label: '4. Medical History' },
    { id: 'dental', label: '5. Dental History' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit PGI Patient Record' : 'Register New PGI Patient'}
      subtitle="Demographics, Disease Categories, Keywords, Parent Consent & Card Upload"
      icon={<UserPlus className="w-4 h-4" aria-hidden="true" />}
      maxWidthClass="max-w-3xl"
    >
      {/* Single-row scrollable tabs */}
      <div
        role="tablist"
        aria-label="Patient registration sections"
        className="tab-scroll-strip border-b border-slate-200 px-4 sm:px-6 bg-slate-50/70 text-xs font-semibold flex-shrink-0"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-teal-600 text-teal-700 font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* 1. Demographics */}
        {activeTab === 'demographics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={firstNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name *
                </label>
                <input
                  id={firstNameId}
                  type="text"
                  required
                  autoFocus
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Aarav"
                />
              </div>
              <div>
                <label htmlFor={lastNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Last Name
                </label>
                <input
                  id={lastNameId}
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Sharma"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor={dobId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth * ({computedAge} yrs)
                </label>
                <input
                  id={dobId}
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label htmlFor={genderId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender *
                </label>
                <select
                  id={genderId}
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor={bloodId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  id={bloodId}
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={langId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Preferred Language
                </label>
                <select
                  id={langId}
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="en">English (EN)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={phoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  id={phoneId}
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label htmlFor={emailId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="patient@pgi.edu.in"
                />
              </div>
            </div>

            <div>
              <label htmlFor={addressId} className="block text-xs font-semibold text-slate-700 mb-1">
                Residential Address
              </label>
              <textarea
                id={addressId}
                rows={2}
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Sector, House No., Chandigarh / Punjab / Haryana"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label htmlFor={emerNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Contact Name
                </label>
                <input
                  id={emerNameId}
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Priya Sharma"
                />
              </div>
              <div>
                <label htmlFor={emerPhoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  id={emerPhoneId}
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="+91 98765 43211"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Clinical, Disease Categories, Keywords & Card */}
        {activeTab === 'clinical' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor={crId} className="block text-xs font-semibold text-slate-700 mb-1">
                  CR Number (Case Reg #)
                </label>
                <input
                  id={crId}
                  type="text"
                  value={crNumber}
                  onChange={(e) => setCrNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  placeholder="CR-2026-0042 (Auto if blank)"
                />
              </div>

              <div>
                <label htmlFor={docAssignId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Attending Doctor (Optional)
                </label>
                <select
                  id={docAssignId}
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Unassigned / Branch Pool</option>
                  {availableDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name || d.doctor_name}
                    </option>
                  ))}
                </select>
              </div>

              {isDoctorOrAdmin && (
                <div>
                  <label htmlFor={stuAssignId} className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign to Student (Optional)
                  </label>
                  <select
                    id={stuAssignId}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">None (Doctor Direct)</option>
                    {availableStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name || st.student_name} ({st.roll_number || st.enrollment_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Disease Categories Checkboxes */}
            <fieldset className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <legend className="text-xs font-bold text-slate-700 px-1">
                Disease Categories (Multi-select)
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {DISEASE_OPTIONS.map((disease) => {
                  const isChecked = diseaseCategories.includes(disease);
                  const cbId = `modal-disease-${disease.replace(/\s+/g, '-').toLowerCase()}`;
                  return (
                    <label
                      key={disease}
                      htmlFor={cbId}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-teal-50 border border-teal-200 text-teal-900 font-semibold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <input
                        id={cbId}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDisease(disease)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-teal-600"
                      />
                      <span>{disease}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Special Case Flag & Case Keywords */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label htmlFor={specialCaseId} className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    id={specialCaseId}
                    type="checkbox"
                    checked={specialCaseFlag}
                    onChange={(e) => setSpecialCaseFlag(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600"
                  />
                  <span>Flag as Special Clinical Case (Medically Compromised / Special Needs)</span>
                </label>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-600 mb-1.5">
                  Case Keywords (Click presets or add custom tags):
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_KEYWORDS.map((kw) => {
                    const active = caseKeywords.includes(kw);
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => toggleKeyword(kw)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                          active
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {kw}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <label htmlFor={customKwId} className="visually-hidden">
                    Add custom case keyword
                  </label>
                  <input
                    id={customKwId}
                    type="text"
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomKeyword();
                      }
                    }}
                    placeholder="Add custom keyword (e.g. Diabetes, Hypertension, Orthognathic)..."
                    className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomKeyword}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add
                  </button>
                </div>

                {caseKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {caseKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 text-[11px] font-semibold"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          aria-label={`Remove keyword ${kw}`}
                          onClick={() => toggleKeyword(kw)}
                          className="hover:text-rose-700"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Patient Card Upload */}
            <div className="pt-2 border-t border-slate-100">
              <label htmlFor={cardUploadId} className="block text-xs font-semibold text-slate-700 mb-1">
                Upload Patient PGI Registration Card (`file`)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id={cardUploadId}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setCardFile(e.target.files?.[0] || null)}
                  className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
                {cardFile && (
                  <span className="text-xs text-slate-600 font-medium truncate">
                    {cardFile.name} ({(cardFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. Parent / Guardian Consent */}
        {activeTab === 'consent' && (
          <div className="space-y-4">
            {isMinorOrSpecial && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">
                    Parent / Guardian Consent Recommended ({computedAge < 18 ? 'Minor < 18 yrs' : 'Special Clinical Case'})
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Please capture guardian contact details and upload signed consent form for PGI clinical compliance.
                  </p>
                </div>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
              <input
                id={consentReqId}
                type="checkbox"
                checked={parentConsentRequired}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setParentConsentRequired(checked);
                  if (checked && parentConsentStatus === 'not_required') {
                    setParentConsentStatus('pending');
                  } else if (!checked) {
                    setParentConsentStatus('not_required');
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 text-teal-600"
              />
              <label htmlFor={consentReqId} className="text-xs font-bold text-slate-800 cursor-pointer">
                Parent / Guardian Consent Required for Treatment
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={guardianNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent / Guardian Full Name
                </label>
                <input
                  id={guardianNameId}
                  type="text"
                  value={parentGuardianName}
                  onChange={(e) => setParentGuardianName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma (Father)"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor={guardianPhoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent / Guardian Phone
                </label>
                <input
                  id={guardianPhoneId}
                  type="tel"
                  value={parentGuardianPhone}
                  onChange={(e) => setParentGuardianPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label htmlFor={consentStatusId} className="block text-xs font-semibold text-slate-700 mb-1">
                Consent Verification Status
              </label>
              <select
                id={consentStatusId}
                value={parentConsentStatus}
                onChange={(e) => setParentConsentStatus(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="not_required">Not Required</option>
                <option value="pending">Pending Signature</option>
                <option value="signed">Signed & Verified</option>
              </select>
            </div>

            <div>
              <label htmlFor={consentFileId} className="block text-xs font-semibold text-slate-700 mb-1">
                Upload Signed Parent / Guardian Consent Form (PDF / Image)
              </label>
              <input
                id={consentFileId}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setConsentFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer border border-slate-300 rounded-lg p-1"
              />
              {consentFile && (
                <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Selected: {consentFile.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 4. Medical History */}
        {activeTab === 'medical' && (
          <div className="space-y-4">
            <div>
              <label htmlFor={allergyId} className="block text-xs font-semibold text-slate-700 mb-1">
                Known Drug Allergies
              </label>
              <input
                id={allergyId}
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="e.g. Penicillin, Sulfa drugs, Latex (or None)"
              />
            </div>

            <div>
              <label htmlFor={medCondId} className="block text-xs font-semibold text-slate-700 mb-1">
                Systemic Medical Conditions
              </label>
              <textarea
                id={medCondId}
                value={medicalConditions}
                onChange={(e) => setMedicalConditions(e.target.value)}
                rows={2}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="e.g. Hypertension, Diabetes, Asthma, Cardiac conditions..."
              />
            </div>

            <div>
              <label htmlFor={currMedId} className="block text-xs font-semibold text-slate-700 mb-1">
                Current Medications
              </label>
              <textarea
                id={currMedId}
                value={currentMedications}
                onChange={(e) => setCurrentMedications(e.target.value)}
                rows={2}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="List active prescription medications..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id={bleedId}
                type="checkbox"
                checked={bleedingDisorders}
                onChange={(e) => setBleedingDisorders(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-slate-300"
              />
              <label htmlFor={bleedId} className="text-xs font-semibold text-slate-700 cursor-pointer">
                Bleeding disorders or anticoagulant therapy (Warfarin / Aspirin / Clopidogrel)
              </label>
            </div>
          </div>
        )}

        {/* 5. Dental History */}
        {activeTab === 'dental' && (
          <div className="space-y-4">
            <div>
              <label htmlFor={chiefId} className="block text-xs font-semibold text-slate-700 mb-1">
                Chief Dental Complaint
              </label>
              <textarea
                id={chiefId}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={3}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="e.g. Pain in lower right molar, sensitivity to cold, routine checkup..."
              />
            </div>

            <div>
              <label htmlFor={brushId} className="block text-xs font-semibold text-slate-700 mb-1">
                Daily Brushing Frequency
              </label>
              <select
                id={brushId}
                value={brushingFrequency}
                onChange={(e) => setBrushingFrequency(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Once daily">Once daily</option>
                <option value="Twice daily">Twice daily</option>
                <option value="Three times daily">Three times daily</option>
                <option value="Irregular">Irregular</option>
              </select>
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>

          <div className="flex flex-wrap gap-2">
            {activeTab !== 'dental' && (
              <button
                type="button"
                onClick={() => {
                  const order: ('demographics' | 'clinical' | 'consent' | 'medical' | 'dental')[] = [
                    'demographics',
                    'clinical',
                    'consent',
                    'medical',
                    'dental',
                  ];
                  const idx = order.indexOf(activeTab);
                  if (idx < order.length - 1) setActiveTab(order[idx + 1]);
                }}
                className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
              >
                Next Section →
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? 'Saving...'
                : initialData
                ? 'Update Patient'
                : 'Save & Register Patient'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
