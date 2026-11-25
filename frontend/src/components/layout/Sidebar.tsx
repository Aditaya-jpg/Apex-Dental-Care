import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    Activity,
    FileSpreadsheet,
    Clock,
    ShieldCheck,
    UserCog,
    Stethoscope,
    FolderOpen,
    Scan,
    GraduationCap,
    ClipboardCheck,
    GitBranch,
    BellRing,
    PanelLeftOpen,
    Pin,
    PinOff,
    X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

interface NavItem {
    name: string;
    to: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: Role[];
}

const navItems: NavItem[] = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Attendance', to: '/attendance', icon: ClipboardCheck, roles: ['admin', 'receptionist'] },
    { name: 'Patient Tracker', to: '/tracker', icon: GitBranch, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Patients', to: '/patients', icon: Users, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Appointments', to: '/appointments', icon: CalendarDays, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Patient Care & Alerts', to: '/patient-care', icon: BellRing, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Doctors', to: '/doctors', icon: Stethoscope, roles: ['admin'] },
    { name: 'Students', to: '/students', icon: GraduationCap, roles: ['admin', 'dentist', 'doctor'] },
    { name: 'Treatments', to: '/treatments', icon: Activity, roles: ['admin', 'dentist', 'doctor'] },
    { name: 'Prescriptions', to: '/prescriptions', icon: FileSpreadsheet, roles: ['admin', 'dentist', 'doctor'] },
    { name: 'X-rays & 3D', to: '/xrays', icon: Scan, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Follow-ups', to: '/followups', icon: Clock, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Documents', to: '/documents', icon: FolderOpen, roles: ['admin', 'dentist', 'doctor', 'student'] },
    { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheck, roles: ['admin'] },
    { name: 'Staff Accounts', to: '/users', icon: UserCog, roles: ['admin'] },
];

interface SidebarProps {
    drawerId?: string;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    drawerId = 'mobile-nav-drawer',
    isMobileOpen = false,
    onCloseMobile,
}) => {
    const { user, hasRole } = useAuth();
    // Chrome-style vertical tabs: collapsed by default (expands on hover), pinned open when toggle clicked
    const [isPinned, setIsPinned] = useState<boolean>(() => {
        try {
            return localStorage.getItem('pgi_sidebar_pinned') === 'true';
        } catch {
            return false;
        }
    });
    const [isHovered, setIsHovered] = useState(false);
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const scrollerRef = useRef<HTMLDialogElement | HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement | null>;
    const sheetRef = useRef<HTMLElement | null>(null);
    const closeTimeoutRef = useRef<number | null>(null);

    const togglePin = () => {
        setIsPinned((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('pgi_sidebar_pinned', String(next));
            } catch {
                // ignore storage errors
            }
            return next;
        });
    };

    const filteredNavItems = navItems.filter((item) => {
        if (!user) return false;
        if (user.role === 'receptionist') {
            return item.to === '/attendance';
        }
        return hasRole(...item.roles);
    });

    const finalizeClose = () => {
        const dialog = dialogRef.current;
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        if (dialog?.open) {
            if (typeof dialog.close === 'function') {
                dialog.close();
            } else {
                dialog.removeAttribute('open');
            }
        }
        onCloseMobile?.();
    };

    const triggerSlideClose = () => {
        const scroller = scrollerRef.current;
        const prefersReducedMotion =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        if (!scroller || prefersReducedMotion || scroller.scrollWidth <= scroller.clientWidth) {
            finalizeClose();
            return;
        }

        scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'auto' });
        closeTimeoutRef.current = window.setTimeout(() => {
            finalizeClose();
        }, 280);
    };

    useEffect(() => {
        const dialog = dialogRef.current;
        const scroller = scrollerRef.current;
        const sheet = sheetRef.current;
        if (!dialog || !scroller || !sheet) return;

        let cancelled = false;
        const openDrawer = async () => {
            if (!dialog.open) {
                if (typeof dialog.showModal === 'function') {
                    try {
                        dialog.showModal();
                    } catch {
                        dialog.setAttribute('open', '');
                    }
                } else {
                    dialog.setAttribute('open', '');
                }
            }

            const supportsInitialTarget =
                typeof CSS !== 'undefined' && CSS.supports?.('scroll-initial-target', 'nearest');

            if (!supportsInitialTarget) {
                scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' as ScrollBehavior });
                await new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                );
            }

            if (!cancelled) {
                scroller.scrollTo({ left: 0, behavior: 'auto' });
            }
        };

        if (isMobileOpen) {
            openDrawer();
        } else if (dialog.open) {
            if (typeof dialog.close === 'function') {
                dialog.close();
            } else {
                dialog.removeAttribute('open');
            }
        }

        return () => {
            cancelled = true;
        };
    }, [isMobileOpen]);

    useEffect(() => {
        const dialog = dialogRef.current;
        const scroller = scrollerRef.current;
        const sheet = sheetRef.current;
        if (!dialog || !scroller || !sheet) return;

        const handleCancel = (e: Event) => {
            if (e.cancelable) {
                e.preventDefault();
                triggerSlideClose();
            } else {
                finalizeClose();
            }
        };

        const handleDialogClick = (e: MouseEvent) => {
            if (!sheet.contains(e.target as Node)) {
                triggerSlideClose();
            }
        };

        dialog.addEventListener('cancel', handleCancel);
        dialog.addEventListener('click', handleDialogClick);

        let scrollCleanup: (() => void) | undefined;
        if (typeof CSS !== 'undefined' && !CSS.supports?.('animation-timeline: scroll()')) {
            const onScroll = () => {
                if (sheet.offsetWidth > 0) {
                    const ratio = Math.max(0, Math.min(1, 1 - scroller.scrollLeft / sheet.offsetWidth));
                    dialog.style.setProperty('--drawer-backdrop', String(ratio));
                }
            };
            scroller.addEventListener('scroll', onScroll, { passive: true });
            scrollCleanup = () => scroller.removeEventListener('scroll', onScroll);
        }

        let observer: IntersectionObserver | undefined;
        if (typeof IntersectionObserver !== 'undefined' && isMobileOpen) {
            const visibleThreshold = Math.min(0.05, 1 / Math.max(window.innerWidth, 1));
            let hasBeenVisible = false;
            observer = new IntersectionObserver(
                (entries) => {
                    const entry = entries[entries.length - 1];
                    if (!entry) return;
                    if (entry.intersectionRatio >= visibleThreshold) {
                        hasBeenVisible = true;
                    } else if (hasBeenVisible && entry.intersectionRatio < visibleThreshold) {
                        finalizeClose();
                    }
                },
                { root: dialog, threshold: [0, visibleThreshold, 0.5, 1] }
            );
            observer.observe(sheet);
        }

        return () => {
            dialog.removeEventListener('cancel', handleCancel);
            dialog.removeEventListener('click', handleDialogClick);
            scrollCleanup?.();
            observer?.disconnect();
        };
    }, [isMobileOpen]);

    useEffect(() => {
        if (!isMobileOpen) return;
        const mq = window.matchMedia('(min-width: 1024px)');
        const onChange = (e: MediaQueryListEvent) => {
            if (e.matches) finalizeClose();
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [isMobileOpen]);

    const renderBrandAndNav = (isDrawer: boolean) => {
        const isExpanded = isDrawer || isPinned || isHovered;
        const collapsed = !isExpanded;
        return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-none">
            {/* Clinic Branding & Pin/Expand Toggle */}
            <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-3'} gap-2 border-b border-slate-800 bg-slate-950/60 flex-shrink-0`}>
                {!collapsed && (
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 flex-shrink-0">
                            <Stethoscope className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                                PGI Dental
                            </p>
                            <p className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                                PGIMER Chandigarh
                            </p>
                        </div>
                    </div>
                )}

                {isDrawer ? (
                    <button
                        type="button"
                        id="mobile-drawer-close"
                        autoFocus
                        onClick={triggerSlideClose}
                        aria-label="Close navigation menu"
                        className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                ) : (
                    <button
                        type="button"
                        id="desktop-sidebar-toggle"
                        onClick={togglePin}
                        aria-label={isPinned ? 'Unpin sidebar (auto-collapse)' : 'Pin sidebar open'}
                        aria-pressed={isPinned}
                        title={isPinned ? 'Pinned open — click to auto-collapse' : 'Click to keep sidebar open'}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isPinned
                            ? 'bg-teal-600/20 text-teal-300 hover:bg-teal-600/30 border border-teal-500/30'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="w-5 h-5" aria-hidden="true" />
                        ) : isPinned ? (
                            <PinOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                            <Pin className="w-4 h-4" aria-hidden="true" />
                        )}
                    </button>
                )}
            </div>

            {/* Navigation Links */}
            <nav aria-label="Clinical navigation" className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
                {!collapsed && (
                    <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap flex items-center justify-between">
                        <span>PGIMER Menu</span>
                        {!isDrawer && !isPinned && (
                            <span className="text-[9px] text-slate-500 font-medium normal-case">Hover preview</span>
                        )}
                    </div>
                )}
                {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            title={collapsed ? item.name : undefined}
                            aria-label={item.name}
                            onClick={() => {
                                if (isDrawer) finalizeClose();
                            }}
                            className={({ isActive }) =>
                                `flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2 px-2.5'} py-2 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${isActive
                                    ? 'bg-teal-600 text-white font-semibold shadow-md shadow-teal-900/30'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                            {!collapsed && <span>{item.name}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* User Status Footer */}
            <div className={`${collapsed ? 'p-2' : 'p-2.5'} border-t border-slate-800 bg-slate-950/40 flex-shrink-0`}>
                <div className={`flex items-center ${collapsed ? 'justify-center p-1.5' : 'gap-2.5 p-2'} rounded-lg bg-slate-800/60`} title={collapsed ? `${user?.full_name} (${user?.role})` : undefined}>
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                        {user?.full_name?.charAt(0) || 'U'}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate max-w-[140px]">{user?.full_name}</p>
                            <span className="inline-block text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
                                {user?.role}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        );
    };

    const isHoverOverlay = !isPinned && isHovered;

    return (
        <>
            {/* Desktop Chrome-Style Vertical Sidebar (68px rail, hover-expand overlay, or pinned open) */}
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`hidden lg:block relative flex-shrink-0 transition-[width] duration-200 ease-out ${
                    isPinned ? 'w-[216px]' : 'w-[68px]'
                }`}
            >
                <aside
                    className={`h-full bg-slate-900 flex flex-col border-r border-slate-800 transition-all duration-200 ease-out ${
                        isHoverOverlay
                            ? 'absolute inset-y-0 left-0 z-40 w-[216px] shadow-2xl shadow-slate-950/50 border-r-slate-700'
                            : 'w-full'
                    }`}
                >
                    {renderBrandAndNav(false)}
                </aside>
            </div>

            {/* Mobile / Tablet Modal Navigation Drawer (< lg) */}
            <dialog
                ref={dialogRef}
                id={drawerId}
                aria-label="PGI Dental navigation menu"
                className="NavDrawer lg:hidden"
            >
                <div ref={scrollerRef} className="NavDrawer-scroller">
                    <aside ref={sheetRef} className="NavDrawer-sheet border-r border-slate-800 shadow-2xl">
                        {renderBrandAndNav(true)}
                    </aside>
                </div>
            </dialog>
        </>
    );
};
