import React, { useEffect, useState } from 'react';
import { Save, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { PerioChart as PerioChartType, PerioSites, PerioToothData } from '../../types';
import { dentalChartApi } from '../../api/dentalChart';

interface PerioChartProps {
  patientId: number;
  canEdit: boolean;
}

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];
const SITES: (keyof PerioSites)[] = ['MB', 'B', 'DB', 'ML', 'L', 'DL'];

const defaultSites = (val = 2): PerioSites => ({
  MB: val,
  B: val,
  DB: val,
  ML: val,
  L: val,
  DL: val,
});

const defaultTooth = (toothNumber: number): PerioToothData => ({
  tooth_number: toothNumber,
  probing_depths: defaultSites(2),
  recession: defaultSites(0),
  bop: false,
  mobility: '0',
  furcation: '0',
  plaque_index: 0,
});

const getPocketClass = (mm: number): string => {
  if (mm >= 6) return 'bg-rose-100 text-rose-900 border-rose-400 font-extrabold';
  if (mm >= 4) return 'bg-amber-100 text-amber-900 border-amber-400 font-bold';
  return 'bg-white text-slate-800 border-slate-300';
};

export const PerioChart: React.FC<PerioChartProps> = ({ patientId, canEdit }) => {
  const [archView, setArchView] = useState<'upper' | 'lower' | 'all'>('upper');
  const [showRecession, setShowRecession] = useState(false);
  const [teethMap, setTeethMap] = useState<Record<number, PerioToothData>>(() => {
    const init: Record<number, PerioToothData> = {};
    ALL_TEETH.forEach((n) => {
      init[n] = defaultTooth(n);
    });
    return init;
  });
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    dentalChartApi
      .getPerioChart(patientId)
      .then((res: PerioChartType) => {
        const merged: Record<number, PerioToothData> = {};
        ALL_TEETH.forEach((n) => {
          const existing = res?.teeth?.[n] || (res?.teeth as any)?.[String(n)];
          merged[n] = existing
            ? {
                ...defaultTooth(n),
                ...existing,
                probing_depths: { ...defaultSites(2), ...(existing.probing_depths || {}) },
                recession: { ...defaultSites(0), ...(existing.recession || {}) },
              }
            : defaultTooth(n);
        });
        setTeethMap(merged);
        setNotes(res?.notes || '');
      })
      .catch(() => {
        // Fallback to clean initialized 32-tooth chart if none saved yet
      })
      .finally(() => setIsLoading(false));
  }, [patientId]);

  const visibleTeeth =
    archView === 'upper' ? UPPER_TEETH : archView === 'lower' ? LOWER_TEETH : ALL_TEETH;

  // Compute live summary metrics across all 32 teeth (192 sites)
  const metrics = (() => {
    let totalSites = 0;
    let sumPpd = 0;
    let deepest = 0;
    let sitesGe4 = 0;
    let bopTeeth = 0;

    ALL_TEETH.forEach((n) => {
      const t = teethMap[n] || defaultTooth(n);
      if (t.bop) bopTeeth += 1;
      SITES.forEach((site) => {
        const val = Number(t.probing_depths?.[site] ?? 0);
        totalSites += 1;
        sumPpd += val;
        if (val > deepest) deepest = val;
        if (val >= 4) sitesGe4 += 1;
      });
    });

    return {
      meanPpd: totalSites ? (sumPpd / totalSites).toFixed(2) : '0.00',
      bopPct: Math.round((bopTeeth / ALL_TEETH.length) * 100),
      deepest,
      sitesGe4,
    };
  })();

  const updateSite = (
    toothNum: number,
    field: 'probing_depths' | 'recession',
    site: keyof PerioSites,
    value: number
  ) => {
    const clamped = Math.max(0, Math.min(15, isNaN(value) ? 0 : value));
    setTeethMap((prev) => {
      const current = prev[toothNum] || defaultTooth(toothNum);
      return {
        ...prev,
        [toothNum]: {
          ...current,
          [field]: {
            ...current[field],
            [site]: clamped,
          },
        },
      };
    });
  };

  const updateToothMeta = <K extends keyof PerioToothData>(
    toothNum: number,
    key: K,
    value: PerioToothData[K]
  ) => {
    setTeethMap((prev) => {
      const current = prev[toothNum] || defaultTooth(toothNum);
      return {
        ...prev,
        [toothNum]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMsg(null);
    try {
      await dentalChartApi.updatePerioChart(patientId, {
        patient_id: patientId,
        teeth: teethMap,
        mean_ppd: Number(metrics.meanPpd),
        bop_percentage: metrics.bopPct,
        deepest_pocket: metrics.deepest,
        sites_ge_4mm: metrics.sitesGe4,
        notes,
      });
      setStatusMsg({ type: 'success', text: '6-site Periodontal Chart saved to patient EMR.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to save Perio Chart.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
      {/* Header & Summary KPIs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" aria-hidden="true" />
            <span>6-Site Periodontal (Perio) Charting — 32 Permanent Teeth</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Probing Pocket Depth (MB, B, DB, ML, L, DL in mm), Recession, Bleeding on Probing (BOP), Mobility & Furcation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-500">Mean PPD:</span>{' '}
            <strong className="text-slate-900 font-mono">{metrics.meanPpd} mm</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs">
            <span className="text-rose-700">% BOP:</span>{' '}
            <strong className="text-rose-900 font-mono">{metrics.bopPct}%</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
            <span className="text-amber-800">Deepest:</span>{' '}
            <strong className="text-amber-950 font-mono">{metrics.deepest} mm</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-500">Sites ≥ 4mm:</span>{' '}
            <strong className="text-amber-800 font-mono">{metrics.sitesGe4}</strong>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(
              [
                { id: 'upper', label: 'Upper Arch (18–28)' },
                { id: 'lower', label: 'Lower Arch (48–38)' },
                { id: 'all', label: 'All 32 Teeth' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setArchView(opt.id)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  archView === opt.id
                    ? 'bg-white text-teal-800 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={showRecession}
            onClick={() => setShowRecession((v) => !v)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              showRecession
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {showRecession ? 'Hide Recession Rows' : 'Show Recession (mm)'}
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
            ≥ 4 mm Moderate Pocket
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-400">
            ≥ 6 mm Deep Pocket
          </span>
          {canEdit && (
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={handleSave}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isSaving ? 'Saving Perio Chart...' : 'Save Perio Chart'}</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          role={statusMsg.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Horizontally Scrollable Perio Matrix */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading periodontal chart...</div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Periodontal 6-site probing pocket chart"
          className="overflow-x-auto border border-slate-200 rounded-xl"
        >
          <table className="min-w-[760px] w-full text-left text-xs border-collapse">
            <caption className="visually-hidden">
              6-site periodontal probing depth, recession, BOP, mobility, furcation, and plaque index chart
            </caption>
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-slate-50 py-2.5 px-3 border-r border-slate-200">
                  Tooth (FDI)
                </th>
                {SITES.map((site) => (
                  <th key={site} scope="col" className="py-2.5 px-2 text-center">
                    {site} (mm)
                  </th>
                ))}
                <th scope="col" className="py-2.5 px-2 text-center">BOP</th>
                <th scope="col" className="py-2.5 px-2 text-center">Mobility</th>
                <th scope="col" className="py-2.5 px-2 text-center">Furcation</th>
                <th scope="col" className="py-2.5 px-2 text-center">Plaque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTeeth.map((toothNum) => {
                const t = teethMap[toothNum] || defaultTooth(toothNum);
                return (
                  <React.Fragment key={toothNum}>
                    <tr className="hover:bg-slate-50/70">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white py-2 px-3 border-r border-slate-200 font-mono font-extrabold text-teal-800 whitespace-nowrap"
                      >
                        #{toothNum}
                      </th>

                      {SITES.map((site) => {
                        const val = t.probing_depths[site] ?? 0;
                        const inputId = `perio-${toothNum}-ppd-${site}`;
                        return (
                          <td key={site} className="py-1.5 px-1.5 text-center">
                            <label htmlFor={inputId} className="visually-hidden">
                              Tooth {toothNum} {site} probing depth mm
                            </label>
                            <input
                              id={inputId}
                              type="number"
                              min={0}
                              max={15}
                              disabled={!canEdit}
                              value={val}
                              onChange={(e) =>
                                updateSite(toothNum, 'probing_depths', site, Number(e.target.value))
                              }
                              className={`w-12 text-center text-xs py-1 rounded border font-mono ${getPocketClass(
                                val
                              )} disabled:opacity-75`}
                            />
                          </td>
                        );
                      })}

                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          disabled={!canEdit}
                          aria-pressed={t.bop}
                          onClick={() => updateToothMeta(toothNum, 'bop', !t.bop)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                            t.bop
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {t.bop ? 'BOP +' : 'No'}
                        </button>
                      </td>

                      <td className="py-1.5 px-1.5 text-center">
                        <label htmlFor={`perio-mob-${toothNum}`} className="visually-hidden">
                          Tooth {toothNum} mobility grade
                        </label>
                        <select
                          id={`perio-mob-${toothNum}`}
                          disabled={!canEdit}
                          value={t.mobility}
                          onChange={(e) => updateToothMeta(toothNum, 'mobility', e.target.value as any)}
                          className="text-xs px-1.5 py-1 border border-slate-300 rounded bg-white"
                        >
                          <option value="0">0</option>
                          <option value="I">I</option>
                          <option value="II">II</option>
                          <option value="III">III</option>
                        </select>
                      </td>

                      <td className="py-1.5 px-1.5 text-center">
                        <label htmlFor={`perio-fur-${toothNum}`} className="visually-hidden">
                          Tooth {toothNum} furcation grade
                        </label>
                        <select
                          id={`perio-fur-${toothNum}`}
                          disabled={!canEdit}
                          value={t.furcation}
                          onChange={(e) => updateToothMeta(toothNum, 'furcation', e.target.value as any)}
                          className="text-xs px-1.5 py-1 border border-slate-300 rounded bg-white"
                        >
                          <option value="0">0</option>
                          <option value="I">I</option>
                          <option value="II">II</option>
                          <option value="III">III</option>
                        </select>
                      </td>

                      <td className="py-1.5 px-1.5 text-center">
                        <label htmlFor={`perio-plq-${toothNum}`} className="visually-hidden">
                          Tooth {toothNum} plaque index
                        </label>
                        <select
                          id={`perio-plq-${toothNum}`}
                          disabled={!canEdit}
                          value={t.plaque_index}
                          onChange={(e) =>
                            updateToothMeta(toothNum, 'plaque_index', Number(e.target.value))
                          }
                          className="text-xs px-1.5 py-1 border border-slate-300 rounded bg-white"
                        >
                          <option value={0}>0</option>
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </td>
                    </tr>

                    {showRecession && (
                      <tr className="bg-slate-50/60 text-[11px]">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-slate-50 py-1 px-3 border-r border-slate-200 text-slate-500 font-medium"
                        >
                          ↳ Recession
                        </th>
                        {SITES.map((site) => {
                          const recVal = t.recession[site] ?? 0;
                          const recId = `perio-${toothNum}-rec-${site}`;
                          return (
                            <td key={site} className="py-1 px-1.5 text-center">
                              <label htmlFor={recId} className="visually-hidden">
                                Tooth {toothNum} {site} gingival recession mm
                              </label>
                              <input
                                id={recId}
                                type="number"
                                min={0}
                                max={12}
                                disabled={!canEdit}
                                value={recVal}
                                onChange={(e) =>
                                  updateSite(toothNum, 'recession', site, Number(e.target.value))
                                }
                                className="w-12 text-center text-[11px] py-0.5 rounded border border-slate-300 bg-white font-mono"
                              />
                            </td>
                          );
                        })}
                        <td colSpan={4} className="py-1 px-2 text-slate-400 italic">
                          Gingival recession (mm)
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Perio Notes */}
      <div>
        <label htmlFor={`perio-notes-${patientId}`} className="block text-xs font-semibold text-slate-700 mb-1">
          Periodontal Diagnosis & Hygiene Assessment Notes (Private Clinical Record)
        </label>
        <textarea
          id={`perio-notes-${patientId}`}
          rows={2}
          disabled={!canEdit}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Generalized chronic periodontitis, Stage II Grade B, calculus deposits on lower anteriors..."
          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white disabled:bg-slate-50"
        />
      </div>
    </div>
  );
};

export default PerioChart;
