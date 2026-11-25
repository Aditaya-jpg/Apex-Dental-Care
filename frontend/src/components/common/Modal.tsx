import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    maxWidthClass?: string;
    closedBy?: 'any' | 'closerequest' | 'none';
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    maxWidthClass = 'max-w-xl',
    closedBy = 'any',
    children,
}) => {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen) {
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
        } else if (dialog.open) {
            if (typeof dialog.close === 'function') {
                dialog.close();
            } else {
                dialog.removeAttribute('open');
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const handleCancel = (e: Event) => {
            if (closedBy === 'none') {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            onClose();
        };

        const handleClose = () => {
            dialog.returnValue = '';
        };

        dialog.addEventListener('cancel', handleCancel);
        dialog.addEventListener('close', handleClose);

        let cleanupPointer: (() => void) | undefined;
        if (closedBy === 'any' && !('closedBy' in HTMLDialogElement.prototype)) {
            let pressedOutside = false;
            const outside = (e: PointerEvent) => {
                const r = dialog.getBoundingClientRect();
                return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
            };
            const onPointerDown = (e: PointerEvent) => {
                pressedOutside = outside(e);
            };
            const onPointerUp = (e: PointerEvent) => {
                if (pressedOutside && outside(e)) {
                    onClose();
                }
            };
            dialog.addEventListener('pointerdown', onPointerDown);
            dialog.addEventListener('pointerup', onPointerUp);
            cleanupPointer = () => {
                dialog.removeEventListener('pointerdown', onPointerDown);
                dialog.removeEventListener('pointerup', onPointerUp);
            };
        }

        return () => {
            dialog.removeEventListener('cancel', handleCancel);
            dialog.removeEventListener('close', handleClose);
            if (cleanupPointer) cleanupPointer();
        };
    }, [closedBy, onClose, isOpen]);

    if (!isOpen) return null;

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            {...({ closedby: closedBy } as any)}
            className={`p-0 m-auto bg-white rounded-2xl ${maxWidthClass} w-[calc(100%-1.5rem)] max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden open:flex open:flex-col animate-fade-in`}
        >
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    {icon && (
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center flex-shrink-0">
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 id={titleId} className="text-base font-bold text-slate-900 truncate">
                            {title}
                        </h1>
                        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition-colors flex-shrink-0"
                >
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">{children}</div>
        </dialog>
    );
};

export default Modal;

