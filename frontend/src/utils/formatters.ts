/**
 * PGI Dental Management System — Formatting & Localization Utilities
 * Standardizes Indian date/time formats, file size display, severity tags,
 * WhatsApp share links, and Google Calendar deep links.
 */

import { LanguageCode, SeverityLevel } from '../types';

export const formatDateIN = (dateStr: string | Date | undefined | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

export const formatDateTimeIN = (dateStr: string | Date | undefined | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

export const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
    en: 'English',
    hi: 'हिंदी (Hindi)',
    pa: 'ਪੰਜਾਬੀ (Punjabi)',
};

export const SEVERITY_META: Record<
    SeverityLevel,
    { label: string; badgeClass: string; dotClass: string }
> = {
    none: {
        label: 'None / Routine',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
    },
    mild: {
        label: 'Mild',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
    },
    moderate: {
        label: 'Moderate',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
        dotClass: 'bg-amber-500',
    },
    severe: {
        label: 'Severe',
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-300',
        dotClass: 'bg-orange-500',
    },
    critical: {
        label: 'Critical',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        dotClass: 'bg-rose-600',
    },
};

export const getPainColorClass = (pain: number): string => {
    if (pain >= 7) return 'text-rose-700 bg-rose-50 border-rose-200';
    if (pain >= 4) return 'text-amber-700 bg-amber-50 border-amber-200';
    if (pain >= 1) return 'text-teal-700 bg-teal-50 border-teal-200';
    return 'text-slate-600 bg-slate-100 border-slate-200';
};

export const buildWhatsAppShareUrl = (phone: string | undefined | null, message: string): string => {
    const digits = (phone || '').replace(/[^\d]/g, '');
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    const encoded = encodeURIComponent(message);
    return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
};

export const buildGoogleCalendarUrl = (opts: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    details?: string;
    location?: string;
}): string => {
    const datePart = opts.date.replace(/-/g, '');
    const startPart = opts.startTime.slice(0, 5).replace(':', '') + '00';
    const endPart = opts.endTime.slice(0, 5).replace(':', '') + '00';
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: opts.title,
        dates: `${datePart}T${startPart}/${datePart}T${endPart}`,
        details: opts.details || 'PGI Dental Branch — Oral Health Sciences Centre, PGIMER Chandigarh',
        location: opts.location || 'Oral Health Sciences Centre, PGIMER Chandigarh',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
