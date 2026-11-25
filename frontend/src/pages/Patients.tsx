import React, { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  UserPlus,
  ArrowRight,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Patient, PaginatedResult, SeverityLevel } from '../types';
import { patientsApi } from '../api/patients';
import { DISEASE_OPTIONS, PatientFormModal } from '../components/patients/PatientFormModal';
import { useAuth } from '../context/AuthContext';
import { SEVERITY_META, getPainColorClass } from '../utils/formatters';

export const Patients: React.FC = () => {
  const [data, setData] = useState<PaginatedResult<Patient> | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [ageGroup, setAgeGroup] = useState<'all' | 'pediatric' | 'adult' | 'geriatric'>('all');
  const [specialCaseOnly, setSpecialCaseOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { user, hasRole } = useAuth();
  const canRegister = hasRole('admin', 'doctor', 'dentist', 'student');
  const isDoctor = user?.role === 'doctor' || user?.role === 'dentist';
  const navigate = useNavigate();

  const searchId = useId();
  const keywordId = useId();
  const ageGroupId = useId();
  const severityId = useId();
  const specialCaseId = useId();
  const scopeId = useId();
  const tableCaptionId = useId();

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const res = await patientsApi.list({
        page,
        pageSize: 15,
        search: search || undefined,
        categories: selectedCategories,
        keyword: keywordFilter || undefined,
        ageGroup,
        specialCase: specialCaseOnly,
        severity: severityFilter,
        scope: isDoctor ? scope : undefined,
      });
      setData(res);
    } catch {
      // Handled by global interceptor
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCategories, keywordFilter, ageGroup, specialCaseOnly, severityFilter, scope, page]);

  const toggleCategory = (cat: string) => {
    setPage(1);
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const resetAllFilters = () => {
    setSearch('');
    setSelectedCategories([]);
    setKeywordFilter('');
    setAgeGroup('all');
    setSpecialCaseOnly(false);
    setSeverityFilter('all');
    setScope('all');
    setPage(1);
  };

  const activeFilterCount =
    selectedCategories.length +
    (keywordFilter ? 1 : 0) +
    (ageGroup !== 'all' ? 1 : 0) +
    (specialCaseOnly ? 1 : 0) +
    (severityFilter !== 'all' ? 1 : 0) +
    (isDoctor && scope !== 'all' ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            PGI Patient Directory & Case Segregation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {user?.role === 'student'
              ? 'Strictly scoped to patients assigned to you for clinical supervision.'
              : 'Branch-wide PGI Dental patient records with CR Numbers, disease category matrix, and severity triage.'}
          </p>
        </div>

        {canRegister && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Register New Patient</span>
          </button>
        )}
      </div>

      {/* Search & Collapsible Segregation Filter Bar */}
      <search className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <label htmlFor={searchId} className="visually-hidden">
              Search patients by CR number, name, patient code, or phone
            </label>
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by CR Number, patient name, code (e.g. P-1001), or phone..."
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDoctor && (
              <div className="flex items-center gap-1.5">
                <label htmlFor={scopeId} className="text-xs font-semibold text-slate-600">
                  Scope:
                </label>
                <select
                  id={scopeId}
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as 'all' | 'mine');
                    setPage(1);
                  }}
                  className="text-xs px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700"
                >
                  <option value="all">All Branch Patients</option>
                  <option value="mine">My Assigned Patients</option>
                </select>
              </div>
            )}

            <button
              type="button"
              aria-expanded={showFiltersPanel}
              onClick={() => setShowFiltersPanel((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                showFiltersPanel || activeFilterCount > 0
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Category & Keyword Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[10px]">
                  {activeFilterCount}
                </span>
              )}
              {showFiltersPanel ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Category-Wise Checkboxes & Keyword / Age / Severity Filters */}
        {showFiltersPanel && (
          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor={keywordId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Case Keyword / Condition
                </label>
                <input
                  id={keywordId}
                  type="text"
                  value={keywordFilter}
                  onChange={(e) => {
                    setKeywordFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. Pediatric, Pregnant, Diabetes..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>

              <div>
                <label htmlFor={ageGroupId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Age Group
                </label>
                <select
                  id={ageGroupId}
                  value={ageGroup}
                  onChange={(e) => {
                    setAgeGroup(e.target.value as any);
                    setPage(1);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50"
                >
                  <option value="all">All Age Groups</option>
                  <option value="pediatric">Pediatric (&lt; 18 yrs)</option>
                  <option value="adult">Adult (18 – 59 yrs)</option>
                  <option value="geriatric">Geriatric (60+ yrs)</option>
                </select>
              </div>

              <div>
                <label htmlFor={severityId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Triage Severity
                </label>
                <select
                  id={severityId}
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="severe">Severe</option>
                  <option value="moderate">Moderate</option>
                  <option value="mild">Mild</option>
                  <option value="none">None / Routine</option>
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label
                  htmlFor={specialCaseId}
                  className="inline-flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer w-full"
                >
                  <input
                    id={specialCaseId}
                    type="checkbox"
                    checked={specialCaseOnly}
                    onChange={(e) => {
                      setSpecialCaseOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600"
                  />
                  <span>Special Cases Only</span>
                </label>
              </div>
            </div>

            <fieldset className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <legend className="text-[11px] font-bold text-slate-600 px-1 uppercase tracking-wider">
                Disease Categories (Multi-Select)
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-1">
                {DISEASE_OPTIONS.map((cat) => {
                  const checked = selectedCategories.includes(cat);
                  const id = `dir-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`;
                  return (
                    <label
                      key={cat}
                      htmlFor={id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer border transition ${
                        checked
                          ? 'bg-teal-600 text-white border-teal-600 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(cat)}
                        className="w-3.5 h-3.5 rounded"
                      />
                      <span className="truncate">{cat}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {/* Active category filter pills summary */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-500">Filtering Categories:</span>
            {selectedCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-semibold hover:bg-teal-200"
              >
                {cat} ×
              </button>
            ))}
          </div>
        )}
      </search>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div tabIndex={0} role="region" aria-labelledby={tableCaptionId} className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption id={tableCaptionId} className="visually-hidden">
              Registered PGI Dental patients directory
            </caption>
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th scope="col" className="py-3.5 px-4">CR Number</th>
                <th scope="col" className="py-3.5 px-4">Patient & Contact</th>
                <th scope="col" className="py-3.5 px-4">Disease Categories</th>
                <th scope="col" className="py-3.5 px-4">Pain / Severity</th>
                <th scope="col" className="py-3.5 px-4">Assigned Team</th>
                <th scope="col" className="py-3.5 px-4">Consent</th>
                <th scope="col" className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Loading patient records...
                  </td>
                </tr>
              ) : !data?.items.length ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No matching patient records found.
                  </td>
                </tr>
              ) : (
                data.items.map((patient) => {
                  const birthDate = new Date(patient.date_of_birth);
                  const age =
                    patient.age ??
                    (isNaN(birthDate.getTime())
                      ? 0
                      : Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000)));
                  const displayName =
                    patient.full_name ||
                    patient.patient_name ||
                    `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
                  const pain = patient.pain_scale ?? 0;
                  const sev = (patient.severity_level as SeverityLevel) || 'none';
                  const consentStatus = patient.parent_consent_status || (patient.parent_consent_required ? 'pending' : 'not_required');

                  return (
                    <tr
                      key={patient.id}
                      onClick={() => navigate(`/patients/${patient.id}`)}
                      className="hover:bg-teal-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 block w-fit">
                          {patient.cr_number || patient.patient_code}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                          {patient.patient_code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                          {displayName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {age} yrs • {patient.gender} • <span className="font-mono">{patient.phone}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[230px]">
                        <div className="flex flex-wrap gap-1">
                          {(patient.disease_categories || []).length === 0 ? (
                            <span className="text-slate-400 text-[11px] italic">Uncategorized</span>
                          ) : (
                            (patient.disease_categories || []).slice(0, 3).map((cat) => {
                              const isSelected = selectedCategories.includes(cat);
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCategory(cat);
                                  }}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                                    isSelected
                                      ? 'bg-teal-600 text-white border-teal-600'
                                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-teal-50 hover:text-teal-800'
                                  }`}
                                >
                                  {cat}
                                </button>
                              );
                            })
                          )}
                          {(patient.disease_categories || []).length > 3 && (
                            <span className="text-[10px] text-slate-400">
                              +{(patient.disease_categories || []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              SEVERITY_META[sev]?.badgeClass || SEVERITY_META.none.badgeClass
                            }`}
                          >
                            {SEVERITY_META[sev]?.label || 'None'}
                          </span>
                          <span
                            className={`inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getPainColorClass(
                              pain
                            )}`}
                          >
                            Pain: {pain}/10
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px]">
                        <div className="font-semibold text-slate-800">
                          {patient.doctor_name || 'Branch Pool'}
                        </div>
                        <div className="text-slate-500">
                          {patient.student_name ? `Trainee: ${patient.student_name}` : 'No Trainee Assigned'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {consentStatus === 'signed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" /> Signed
                          </span>
                        ) : consentStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <ShieldAlert className="w-3 h-3" aria-hidden="true" /> Pending
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Not Req.</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patients/${patient.id}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 group-hover:bg-teal-600 group-hover:text-white text-slate-700 font-semibold text-[11px] transition-all inline-flex items-center gap-1.5"
                        >
                          <span>EMR</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {data && data.total_pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {data.items.length} of {data.total} patients
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-semibold text-slate-800">
                Page {page} of {data.total_pages}
              </span>
              <button
                type="button"
                disabled={page >= data.total_pages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Register Patient Modal */}
      {isModalOpen && (
        <PatientFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={async (payload) => {
            const newPat = await patientsApi.create(payload);
            fetchPatients();
            if (newPat?.id) {
              navigate(`/patients/${newPat.id}`);
            }
            return newPat;
          }}
        />
      )}
    </div>
  );
};

export default Patients;
