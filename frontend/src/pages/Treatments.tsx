import React, { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    FileText,
    Plus,
    Search,
    CheckCircle,
    Clock,
    Layers,
    ChevronDown,
    ChevronUp,
    User as UserIcon,
    Calendar,
    BookOpen,
} from 'lucide-react';
import { treatmentsApi } from '../api/treatments';
import { useAuth } from '../context/AuthContext';
import TreatmentPlanModal from '../components/treatments/TreatmentPlanModal';
import { TreatmentItem } from '../types';
import Modal from '../components/common/Modal';
import { formatDateIN } from '../utils/formatters';

export default function Treatments() {
    const { hasRole } = useAuth();
    const queryClient = useQueryClient();
    const canEdit = hasRole('admin', 'doctor', 'dentist', 'student');

    const [activeTab, setActiveTab] = useState<'plans' | 'catalog'>('plans');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [selectedItemForUpdate, setSelectedItemForUpdate] = useState<TreatmentItem | null>(null);
    const [updateStatus, setUpdateStatus] = useState<string>('completed');
    const [updateNotes, setUpdateNotes] = useState<string>('');

    const searchId = useId();
    const statusSelectId = useId();
    const updateStatusId = useId();
    const updateNotesId = useId();

    const { data: plans = [], isLoading: isPlansLoading } = useQuery({
        queryKey: ['treatmentPlans', statusFilter],
        queryFn: () =>
            treatmentsApi.listPlans(statusFilter !== 'all' ? { status: statusFilter } : undefined),
    });

    const { data: catalog = [], isLoading: isCatalogLoading } = useQuery({
        queryKey: ['procedureCatalog'],
        queryFn: treatmentsApi.getCatalog,
    });

    const updateItemMutation = useMutation({
        mutationFn: ({ itemId, data }: { itemId: number; data: any }) =>
            treatmentsApi.updateItem(itemId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treatmentPlans'] });
            setSelectedItemForUpdate(null);
            setUpdateNotes('');
        },
    });

    const handleUpdateItemSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemForUpdate) return;
        updateItemMutation.mutate({
            itemId: selectedItemForUpdate.id,
            data: {
                status: updateStatus,
                notes: updateNotes,
            },
        });
    };

    const filteredPlans = plans.filter((plan) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const patient = (plan.patient_name || '').toLowerCase();
        const diagnosis = ((plan as any).diagnosis || plan.title || '').toLowerCase();
        return patient.includes(q) || diagnosis.includes(q) || plan.id.toString().includes(q);
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Active
                    </span>
                );
            case 'completed':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Completed
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
                        Cancelled
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        <Clock className="w-3 h-3 mr-1" aria-hidden="true" /> Draft
                    </span>
                );
        }
    };

    const getItemStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Completed</span>;
            case 'in_progress':
                return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">In Progress</span>;
            case 'cancelled':
                return <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">Cancelled</span>;
            default:
                return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">Planned</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Clinical Treatment Management
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Multi-procedure clinical treatment plans and standard PGI Dental procedure catalog.
                    </p>
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => setIsPlanModalOpen(true)}
                        className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl shadow-sm hover:bg-teal-700 transition self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                        New Treatment Plan
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Treatment sections" className="tab-scroll-strip border-b border-slate-200">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'plans'}
                    onClick={() => setActiveTab('plans')}
                    className={`py-3 px-5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'plans'
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                >
                    <Layers className="w-4 h-4" aria-hidden="true" />
                    <span>Treatment Plans ({plans.length})</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'catalog'}
                    onClick={() => setActiveTab('catalog')}
                    className={`py-3 px-5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'catalog'
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                >
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    <span>Clinical Procedure Catalog ({catalog.length})</span>
                </button>
            </div>

            {activeTab === 'plans' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <label htmlFor={searchId} className="visually-hidden">
                                    Search treatment plans
                                </label>
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                                <input
                                    id={searchId}
                                    type="search"
                                    placeholder="Search plan, patient or diagnosis..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <label htmlFor={statusSelectId} className="text-xs font-medium text-slate-500">
                                    Status:
                                </label>
                                <select
                                    id={statusSelectId}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 font-medium">
                            Showing {filteredPlans.length} plans
                        </div>
                    </div>

                    {isPlansLoading ? (
                        <div className="py-16 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-teal-600 border-t-transparent" />
                            <p className="text-sm text-slate-500 mt-3 font-medium">Loading treatment plans...</p>
                        </div>
                    ) : filteredPlans.length === 0 ? (
                        <div className="bg-white py-16 text-center rounded-xl border border-slate-200">
                            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
                            <p className="text-base font-semibold text-slate-700">No treatment plans found</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                No clinical treatment plans match the selected criteria.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredPlans.map((plan) => {
                                const isExpanded = expandedPlanId === plan.id;
                                const planItems: TreatmentItem[] = plan.items || plan.treatments || [];
                                const completedItems = planItems.filter((i) => i.status === 'completed').length;
                                const totalItems = planItems.length;
                                const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                                return (
                                    <div
                                        key={plan.id}
                                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                                    >
                                        <button
                                            type="button"
                                            aria-expanded={isExpanded}
                                            onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                                            className="w-full text-left p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60"
                                        >
                                            <div className="flex items-start space-x-4">
                                                <div className="p-3 bg-teal-50 text-teal-600 rounded-xl mt-1">
                                                    <FileText className="w-5 h-5" aria-hidden="true" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-900 text-base">
                                                            Plan #{plan.id}
                                                        </span>
                                                        {getStatusBadge(plan.status)}
                                                    </div>
                                                    <div className="text-sm font-medium text-slate-700 mt-1">
                                                        {plan.title || (plan as any).diagnosis || 'General Dental Treatment'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 mt-1.5">
                                                        <span className="flex items-center">
                                                            <UserIcon className="w-3.5 h-3.5 mr-1 text-slate-400" aria-hidden="true" />
                                                            Patient:{' '}
                                                            <Link
                                                                to={`/patients/${plan.patient_id}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="ml-1 text-teal-700 hover:underline font-medium"
                                                            >
                                                                {plan.patient_name || `Patient #${plan.patient_id}`}
                                                            </Link>
                                                        </span>
                                                        {(plan.doctor_name || plan.dentist_name) && (
                                                            <span>
                                                                Doctor:{' '}
                                                                <strong className="text-slate-700">
                                                                    {plan.doctor_name || plan.dentist_name}
                                                                </strong>
                                                            </span>
                                                        )}
                                                        <span className="flex items-center">
                                                            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" aria-hidden="true" />
                                                            Created: {formatDateIN(plan.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                <div className="text-right">
                                                    <div className="text-xs font-semibold text-slate-500">
                                                        Clinical Progress ({completedItems}/{totalItems})
                                                    </div>
                                                    <div className="w-28 bg-slate-200 rounded-full h-2 mt-1.5 overflow-hidden">
                                                        <div
                                                            className="bg-emerald-500 h-2 rounded-full"
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="text-slate-400 p-1">
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-5 h-5" aria-hidden="true" />
                                                    ) : (
                                                        <ChevronDown className="w-5 h-5" aria-hidden="true" />
                                                    )}
                                                </div>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                                                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                                                    Scheduled Procedure Items
                                                </h2>

                                                {planItems.length === 0 ? (
                                                    <p className="text-xs text-slate-500 italic">
                                                        No procedures added to this plan yet.
                                                    </p>
                                                ) : (
                                                    <div tabIndex={0} role="region" aria-label="Treatment procedures table" className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                                        <table className="w-full text-left text-xs">
                                                            <thead>
                                                                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                                                    <th scope="col" className="py-2.5 px-3">Tooth</th>
                                                                    <th scope="col" className="py-2.5 px-3">Procedure Name</th>
                                                                    <th scope="col" className="py-2.5 px-3">Status</th>
                                                                    <th scope="col" className="py-2.5 px-3">Clinical Notes</th>
                                                                    {canEdit && (
                                                                        <th scope="col" className="py-2.5 px-3 text-right">Action</th>
                                                                    )}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {planItems.map((item) => (
                                                                    <tr key={item.id} className="hover:bg-slate-50/60">
                                                                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                                                                            {item.tooth_number ? `Tooth #${item.tooth_number}` : 'Full Arch / General'}
                                                                        </td>
                                                                        <td className="py-2.5 px-3 font-medium text-slate-900">
                                                                            {item.procedure_name}
                                                                        </td>
                                                                        <td className="py-2.5 px-3">{getItemStatusBadge(item.status)}</td>
                                                                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                                                                            {item.notes || '-'}
                                                                        </td>
                                                                        {canEdit && (
                                                                            <td className="py-2.5 px-3 text-right">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedItemForUpdate(item);
                                                                                        setUpdateStatus(item.status);
                                                                                        setUpdateNotes(item.notes || '');
                                                                                    }}
                                                                                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                                                                                >
                                                                                    Update
                                                                                </button>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Clinical Procedure Catalog Tab */}
            {activeTab === 'catalog' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-800">
                            PGI Standard Dental Procedure Directory
                        </h2>
                        <span className="text-xs text-slate-500 font-medium">{catalog.length} procedures</span>
                    </div>

                    {isCatalogLoading ? (
                        <div className="py-12 text-center">
                            <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-teal-600 border-t-transparent" />
                        </div>
                    ) : (
                        <div tabIndex={0} role="region" aria-label="Procedure catalog table" className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        <th scope="col" className="py-3 px-4">Code</th>
                                        <th scope="col" className="py-3 px-4">Procedure Name</th>
                                        <th scope="col" className="py-3 px-4">Category</th>
                                        <th scope="col" className="py-3 px-4">Est. Duration</th>
                                        <th scope="col" className="py-3 px-4">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {catalog.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/70">
                                            <td className="py-3 px-4 font-mono text-xs font-bold text-teal-700">{item.code}</td>
                                            <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-500">
                                                {item.estimated_duration_minutes || 30} mins
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-500 max-w-sm truncate">
                                                {item.description || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {isPlanModalOpen && (
                <TreatmentPlanModal
                    isOpen={isPlanModalOpen}
                    onClose={() => setIsPlanModalOpen(false)}
                    onSuccess={() => {
                        setIsPlanModalOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['treatmentPlans'] });
                    }}
                />
            )}

            {/* Update Item Status Modal */}
            <Modal
                isOpen={!!selectedItemForUpdate}
                onClose={() => setSelectedItemForUpdate(null)}
                title={`Update Procedure: ${selectedItemForUpdate?.procedure_name || ''}`}
                subtitle={`Tooth: ${selectedItemForUpdate?.tooth_number ? `#${selectedItemForUpdate.tooth_number}` : 'General'}`}
                maxWidthClass="max-w-md"
            >
                {selectedItemForUpdate && (
                    <form onSubmit={handleUpdateItemSubmit} className="p-6 space-y-4">
                        <div>
                            <label htmlFor={updateStatusId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Status
                            </label>
                            <select
                                id={updateStatusId}
                                autoFocus
                                value={updateStatus}
                                onChange={(e) => setUpdateStatus(e.target.value)}
                                className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2"
                            >
                                <option value="planned">Planned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed (Triggers Post-Treatment Instructions)</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor={updateNotesId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Completion Notes / Observations
                            </label>
                            <textarea
                                id={updateNotesId}
                                value={updateNotes}
                                onChange={(e) => setUpdateNotes(e.target.value)}
                                rows={3}
                                placeholder="e.g. Composite shade A2 placed, occlusion checked..."
                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedItemForUpdate(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updateItemMutation.isPending}
                                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
                            >
                                {updateItemMutation.isPending ? 'Saving...' : 'Save Update'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
