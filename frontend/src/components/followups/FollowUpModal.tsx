import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { followupsApi } from '../../api/followups';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';

interface FollowUpModalProps {
    patientId?: number;
    patientName?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
    patientId,
    patientName,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { user } = useAuth();
    const doctorId = user?.doctor_id || user?.dentist_profile?.id || 1;

    const [scheduledDate, setScheduledDate] = useState(
        new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    );
    const [reason, setReason] = useState('Post-treatment review and symptom check');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim() || !scheduledDate) {
            setError('Date and reason are required.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await followupsApi.create({
                patient_id: patientId || 1,
                dentist_id: doctorId,
                scheduled_date: scheduledDate,
                reason: reason.trim(),
                notes: notes.trim() || undefined,
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to schedule follow-up');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Schedule Clinical Follow-Up"
            subtitle={patientName ? `Patient: ${patientName}` : 'Post-procedure clinical recall'}
            icon={<Clock className="w-4 h-4" aria-hidden="true" />}
            maxWidthClass="max-w-md"
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                    <div
                        role="alert"
                        className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium"
                    >
                        {error}
                    </div>
                )}

                <div>
                    <label
                        htmlFor="followup-target-date"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                        Follow-Up Target Date *
                    </label>
                    <input
                        id="followup-target-date"
                        type="date"
                        required
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                <div>
                    <label
                        htmlFor="followup-reason"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                        Reason for Follow-Up *
                    </label>
                    <input
                        id="followup-reason"
                        type="text"
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Suture removal, check percussion sensitivity, crown fit"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                <div>
                    <label
                        htmlFor="followup-notes"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                        Clinical Notes
                    </label>
                    <textarea
                        id="followup-notes"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional reminders or instructions for the clinical team..."
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? 'Scheduling…' : 'Confirm Follow-Up'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default FollowUpModal;
