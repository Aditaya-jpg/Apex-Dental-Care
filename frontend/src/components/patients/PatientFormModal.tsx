import React, { useState, useEffect } from 'react';
import { X, UserPlus, HeartPulse, Stethoscope, FileText, CheckSquare, Upload, CreditCard } from 'lucide-react';
import { Patient, Student } from '../../types';
import { studentsApi } from '../../api/students';
import { patientsApi } from '../../api/patients';
import { useAuth } from '../../context/AuthContext';

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  initialData?: Patient | null;
}

const DISEASE_OPTIONS = [
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
  'Other',
];

export const PatientFormModal: React.FC<PatientFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(initialData?.first_name || '');
  const [lastName, setLastName] = useState(initialData?.last_name || '');
  const [dob, setDob] = useState(initialData?.date_of_birth || '1995-01-01');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(initialData?.gender || 'Male');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [emergencyContactName, setEmergencyContactName] = useState(initialData?.emergency_contact_name || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialData?.emergency_contact_phone || '');
  const [bloodGroup, setBloodGroup] = useState(initialData?.blood_group || 'O+');

  // Hierarchy & Identification Fields
  const [crNumber, setCrNumber] = useState(initialData?.cr_number || '');
  const [studentId, setStudentId] = useState<number | ''>(initialData?.student_id || '');
  const [diseaseCategories, setDiseaseCategories] = useState<string[]>(initialData?.disease_categories || []);
  const [cardFile, setCardFile] = useState<File | null>(null);

  // Student list for assignment (if Doctor/Admin)
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);

  // Medical History
  const [allergies, setAllergies] = useState(initialData?.medical_history?.allergies || '');
  const [medicalConditions, setMedicalConditions] = useState(initialData?.medical_history?.medical_conditions || '');
  const [currentMedications, setCurrentMedications] = useState(initialData?.medical_history?.current_medications || '');
  const [bleedingDisorders, setBleedingDisorders] = useState(initialData?.medical_history?.bleeding_disorders || false);

  // Dental History
  const [chiefComplaint, setChiefComplaint] = useState(initialData?.dental_history?.chief_complaint || '');
  const [brushingFrequency, setBrushingFrequency] = useState(initialData?.dental_history?.brushing_frequency || 'Twice daily');

  const [activeTab, setActiveTab] = useState<'demographics' | 'medical' | 'dental' | 'clinical'>('demographics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available students if logged-in user is doctor or admin
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'dentist') {
      studentsApi.list()
        .then((res) => setAvailableStudents(res || []))
        .catch(() => setAvailableStudents([]));
    }
  }, [user]);

  if (!isOpen) return null;

  const toggleDisease = (disease: string) => {
    if (diseaseCategories.includes(disease)) {
      setDiseaseCategories(diseaseCategories.filter((d) => d !== disease));
    } else {
      setDiseaseCategories([...diseaseCategories, disease]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone || !dob) {
      setError('Please fill in all mandatory demographic fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob,
        gender,
        phone,
        email: email || undefined,
        address: address || undefined,
        emergency_contact_name: emergencyContactName || undefined,
        emergency_contact_phone: emergencyContactPhone || undefined,
        blood_group: bloodGroup || undefined,
        cr_number: crNumber.trim() || undefined,
        disease_categories: diseaseCategories,
        student_id: studentId ? Number(studentId) : null,
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

      // If user selected a patient card file, upload it
      const savedPatientId = result?.id || initialData?.id;
      if (cardFile && savedPatientId) {
        const formData = new FormData();
        formData.append('card_file', cardFile);
        if (crNumber) formData.append('cr_number', crNumber);
        await patientsApi.uploadCard(savedPatientId, formData);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {initialData ? 'Edit Patient Record' : 'Register New Patient'}
              </h2>
              <p className="text-xs text-slate-500">Demographic, Disease Categories & Clinical Assignment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/40 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'demographics', label: '1. Demographics & Contact' },
            { id: 'clinical', label: '2. Clinical & Disease Categories' },
            { id: 'medical', label: '3. Medical History' },
            { id: 'dental', label: '4. Dental History' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-700 font-bold bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* 1. Demographics */}
          {activeTab === 'demographics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="e.g. Rahul"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="e.g. Sharma"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="patient@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="Flat/House No., Street, City, PIN Code"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="e.g. Priya Sharma"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    placeholder="+91 98765 43211"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. Clinical & Disease Categories */}
          {activeTab === 'clinical' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CR Number (Case Registration Number)
                  </label>
                  <input
                    type="text"
                    value={crNumber}
                    onChange={(e) => setCrNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                    placeholder="e.g. CR-2026-0042 (Leave blank to auto-generate)"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Unique clinic registration identifier</p>
                </div>

                {/* Student Assignment (Only for Doctor/Admin) */}
                {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'dentist') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assign to Student
                    </label>
                    <select
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                    >
                      <option value="">None (Doctor Handles Directly)</option>
                      {availableStudents.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.student_name} ({st.enrollment_number || st.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Delegates patient examination to student</p>
                  </div>
                )}
              </div>

              {/* Disease Categories Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Disease Categories (Select all that apply)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {DISEASE_OPTIONS.map((disease) => {
                    const isChecked = diseaseCategories.includes(disease);
                    return (
                      <label
                        key={disease}
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isChecked ? 'bg-teal-50 border border-teal-200 text-teal-900 font-semibold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDisease(disease)}
                          className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        />
                        <span>{disease}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Patient Card Upload */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Patient Identity / Registration Card
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setCardFile(e.target.files?.[0] || null)}
                    className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                  />
                  {cardFile && (
                    <span className="text-xs text-slate-600 font-medium truncate">
                      {cardFile.name} ({(cardFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Accepted formats: PDF, JPG, JPEG, PNG (Max 15MB). Securely stored and previewable in patient profile.
                </p>
              </div>
            </div>
          )}

          {/* 3. Medical History */}
          {activeTab === 'medical' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Known Drug Allergies</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="e.g. Penicillin, Sulfa drugs, Latex (or None)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Systemic Medical Conditions</label>
                <textarea
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="e.g. Hypertension, Diabetes, Asthma, Heart disease..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Medications</label>
                <textarea
                  value={currentMedications}
                  onChange={(e) => setCurrentMedications(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="List prescription and over-the-counter medications..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bleedingDisorders"
                  checked={bleedingDisorders}
                  onChange={(e) => setBleedingDisorders(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <label htmlFor="bleedingDisorders" className="text-xs font-semibold text-slate-700">
                  Patient reports bleeding disorders or is on anticoagulant therapy (Warfarin/Aspirin)
                </label>
              </div>
            </div>
          )}

          {/* 4. Dental History */}
          {activeTab === 'dental' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chief Dental Complaint *</label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="e.g. Toothache on chewing, routine cleaning, broken tooth..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Daily Brushing Frequency</label>
                <select
                  value={brushingFrequency}
                  onChange={(e) => setBrushingFrequency(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
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
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>

            <div className="flex gap-2">
              {activeTab === 'demographics' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('clinical')}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                >
                  Next: Clinical →
                </button>
              )}
              {activeTab === 'clinical' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('medical')}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                >
                  Next: Medical →
                </button>
              )}
              {activeTab === 'medical' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('dental')}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                >
                  Next: Dental →
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : initialData ? 'Update Patient' : 'Register Patient'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
