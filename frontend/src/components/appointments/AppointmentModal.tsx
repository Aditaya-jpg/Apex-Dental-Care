import React, { useState, useEffect, useId } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { Patient, Doctor, AppointmentType, Appointment } from '../../types';
import { doctorsApi } from '../../api/doctors';
import { patientsApi } from '../../api/patients';
import { appointmentsApi } from '../../api/appointments';
import Modal from '../common/Modal';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: Appointment | null;
  defaultPatientId?: number;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultDoctorId?: number;
  defaultOperatory?: string;
}

const DEFAULT_OPERATORIES = [
  'Operatory 1',
  'Operatory 2',
  'Operatory 3',
  'Operatory 4',
  'OT / Surgical Suite',
];

const FALLBACK_TYPES: AppointmentType[] = [
  { id: 1, name: 'Consultation & Diagnosis', duration_minutes: 30, color_code: '#0d9488' },
  { id: 2, name: 'Root Canal Therapy (RCT)', duration_minutes: 60, color_code: '#8b5cf6' },
  { id: 3, name: 'Periodontal Scaling / Surgery', duration_minutes: 45, color_code: '#3b82f6' },
  { id: 4, name: 'Extraction / Minor Oral Surgery', duration_minutes: 45, color_code: '#ef4444' },
  { id: 5, name: 'Follow-up Checkup', duration_minutes: 30, color_code: '#10b981' },
];

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  defaultPatientId,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  defaultDoctorId,
  defaultOperatory,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [types, setTypes] = useState<AppointmentType[]>([]);

  const [patientId, setPatientId] = useState<number | ''>(
    defaultPatientId || initialData?.patient_id || ''
  );
  const [doctorId, setDoctorId] = useState<number | ''>(
    defaultDoctorId || initialData?.doctor_id || initialData?.dentist_id || ''
  );
  const [operatory, setOperatory] = useState<string>(
    defaultOperatory || initialData?.operatory || 'Operatory 1'
  );
  const [apptType, setApptType] = useState<string>(
    (typeof initialData?.appointment_type === 'string'
      ? initialData.appointment_type
      : initialData?.appointment_type_name) || 'Consultation & Diagnosis'
  );
  const [apptDate, setApptDate] = useState(
    defaultDate || initialData?.appointment_date || new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(
    defaultStartTime || initialData?.start_time || '10:00:00'
  );
  const [endTime, setEndTime] = useState(
    defaultEndTime || initialData?.end_time || '10:30:00'
  );
  const [reason, setReason] = useState(initialData?.reason || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patSelectId = useId();
  const docSelectId = useId();
  const opSelectId = useId();
  const typeSelectId = useId();
  const dateInputId = useId();
  const startInputId = useId();
  const endInputId = useId();
  const reasonInputId = useId();
  const notesInputId = useId();

  useEffect(() => {
    if (!isOpen) return;
    if (defaultDate) setApptDate(defaultDate);
    if (defaultStartTime) setStartTime(defaultStartTime);
    if (defaultEndTime) setEndTime(defaultEndTime);
    if (defaultDoctorId) setDoctorId(defaultDoctorId);
    if (defaultOperatory) setOperatory(defaultOperatory);

    Promise.all([
      patientsApi.list({ page: 1, pageSize: 100 }).catch(() => ({ items: [] })),
      doctorsApi.list().catch(() => []),
      appointmentsApi.getTypes().catch(() => FALLBACK_TYPES),
    ]).then(([pRes, dRes, tRes]) => {
      setPatients(pRes.items || []);
      setDoctors(dRes || []);
      const resolvedTypes = tRes && tRes.length > 0 ? tRes : FALLBACK_TYPES;
      setTypes(resolvedTypes);

      if (!doctorId && !defaultDoctorId && dRes && dRes.length > 0) {
        setDoctorId(dRes[0].id);
        if (!defaultOperatory && dRes[0].cabin_operatory) {
          setOperatory(dRes[0].cabin_operatory);
        }
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId || !apptDate || !startTime || !endTime) {
      setError('Please select patient, attending doctor, date, and valid time.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const matchedType = types.find((t) => t.name === apptType);
      const payload: any = {
        patient_id: Number(patientId),
        doctor_id: Number(doctorId),
        dentist_id: Number(doctorId),
        operatory,
        appointment_type: apptType,
        appointment_type_id: matchedType?.id,
        appointment_date: apptDate,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        reason,
        notes,
      };

      if (initialData) {
        await appointmentsApi.update(initialData.id, payload);
      } else {
        await appointmentsApi.create(payload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Doctor or Operatory conflict detected or request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Reschedule Appointment' : 'Book PGI Dental Appointment'}
      subtitle="Live doctor & operatory conflict detection + Google Calendar sync"
      icon={<Calendar className="w-4 h-4" aria-hidden="true" />}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor={patSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
            Select Patient *
          </label>
          <select
            id={patSelectId}
            autoFocus={!defaultPatientId}
            value={patientId}
            disabled={!!defaultPatientId}
            onChange={(e) => setPatientId(Number(e.target.value))}
            required
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
          >
            <option value="">-- Choose Patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || `${p.first_name} ${p.last_name}`} ({p.cr_number || p.patient_code}) — {p.phone}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={docSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
              Attending Doctor *
            </label>
            <select
              id={docSelectId}
              value={doctorId}
              onChange={(e) => setDoctorId(Number(e.target.value))}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">-- Select Doctor --</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name || d.doctor_name} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={opSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
              Operatory / Chair *
            </label>
            <select
              id={opSelectId}
              value={operatory}
              onChange={(e) => setOperatory(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              {DEFAULT_OPERATORIES.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={typeSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
            Appointment Type
          </label>
          <select
            id={typeSelectId}
            value={apptType}
            onChange={(e) => setApptType(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            {types.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} ({t.duration_minutes} min)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={dateInputId} className="block text-xs font-semibold text-slate-700 mb-1">
              Date *
            </label>
            <input
              id={dateInputId}
              type="date"
              required
              value={apptDate}
              onChange={(e) => setApptDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor={startInputId} className="block text-xs font-semibold text-slate-700 mb-1">
              Start Time *
            </label>
            <input
              id={startInputId}
              type="time"
              required
              value={startTime.slice(0, 5)}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor={endInputId} className="block text-xs font-semibold text-slate-700 mb-1">
              End Time *
            </label>
            <input
              id={endInputId}
              type="time"
              required
              value={endTime.slice(0, 5)}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label htmlFor={reasonInputId} className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Visit
          </label>
          <input
            id={reasonInputId}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Root Canal Obturation, Crown Prep"
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label htmlFor={notesInputId} className="block text-xs font-semibold text-slate-700 mb-1">
            Internal Clinical Notes
          </label>
          <textarea
            id={notesInputId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Operatory setup or clinical reminders..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Checking Conflicts...' : initialData ? 'Update Appointment' : 'Confirm Booking'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AppointmentModal;
