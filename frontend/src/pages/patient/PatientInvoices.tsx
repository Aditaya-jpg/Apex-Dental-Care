import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  Download,
  CheckCircle2,
  Clock,
  IndianRupee,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { billingApi } from '../../api/billing';
import { Invoice } from '../../types';
import { formatINR, formatDateIN } from '../../utils/formatters';

export default function PatientInvoices() {
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'due' | 'paid'>('all');
  const [expandedInvoices, setExpandedInvoices] = useState<Record<number, boolean>>({});

  // Fetch Invoices
  const {
    data: invoices = [],
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
    isRefetching: isRefetchingInvoices,
  } = useQuery({
    queryKey: ['patientMyInvoices'],
    queryFn: () => billingApi.listMyInvoices(),
  });

  const toggleExpand = (id: number) => {
    setExpandedInvoices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate totals
  const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalBalanceDue = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceFilter === 'due') return Number(inv.balance) > 0;
    if (invoiceFilter === 'paid') return inv.status === 'paid';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                My Invoices & Clinical Statements
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Review your treatment invoices, procedure items, and download official PDF statements.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => refetchInvoices()}
          disabled={isRefetchingInvoices}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetchingInvoices ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Total Invoiced</span>
            <span className="p-1 rounded bg-teal-50 text-teal-600">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">
            {formatINR(totalBilled)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Lifetime clinical services total</p>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <span>Outstanding Due</span>
              <span className="p-1 rounded bg-rose-50 text-rose-600">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-rose-600 mt-2">
              {formatINR(totalBalanceDue)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Pending balance across all invoices</p>
          </div>
        </div>
      </div>

      {/* Invoices View */}
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider mr-1">Filter:</span>
          <button
            onClick={() => setInvoiceFilter('all')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              invoiceFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All ({invoices.length})
          </button>
          <button
            onClick={() => setInvoiceFilter('due')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              invoiceFilter === 'due'
                ? 'bg-rose-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Due ({invoices.filter((i) => Number(i.balance) > 0).length})
          </button>
          <button
            onClick={() => setInvoiceFilter('paid')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              invoiceFilter === 'paid'
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Settled ({invoices.filter((i) => i.status === 'paid').length})
          </button>
        </div>

        {invoicesLoading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-2" />
            <span>Loading your invoices...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No invoices match selected filter</p>
            <p className="text-xs text-slate-400">You are all caught up on dental care invoices.</p>
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const hasBalance = Number(inv.balance) > 0;
            const isExpanded = expandedInvoices[inv.id] !== false;

            return (
              <div
                key={inv.id}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Invoice Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {inv.invoice_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : inv.status === 'partially_paid'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {inv.status === 'paid'
                          ? 'Settled'
                          : inv.status === 'partially_paid'
                          ? 'Partial'
                          : 'Unpaid'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Issued: {formatDateIN(inv.issue_date)} • Due Date: {formatDateIN(inv.due_date)}
                    </p>
                  </div>

                  {/* Actions & Balance */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Amount</p>
                      <p className="text-base font-black text-slate-900">
                        {formatINR(inv.total)}
                      </p>
                    </div>

                    <button
                      onClick={() => billingApi.downloadPdf(inv.id, inv.invoice_number)}
                      className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      title="Download Invoice PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => toggleExpand(inv.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 transition"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <>
                    {/* Itemized Procedures Breakdown */}
                    {inv.items && inv.items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th className="py-2.5 px-3">Treatment / Procedure</th>
                              <th className="py-2.5 px-3 text-center">Qty</th>
                              <th className="py-2.5 px-3 text-right">Unit Price</th>
                              <th className="py-2.5 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {inv.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-3 font-medium">{item.description}</td>
                                <td className="py-2 px-3 text-center">{item.quantity}</td>
                                <td className="py-2 px-3 text-right">{formatINR(item.unit_price)}</td>
                                <td className="py-2 px-3 text-right font-bold">{formatINR(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-slate-200 text-xs font-semibold text-slate-700">
                            <tr>
                              <td colSpan={3} className="py-2 px-3 text-right text-slate-500">Invoice Total:</td>
                              <td className="py-2 px-3 text-right font-black text-slate-900">{formatINR(inv.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
