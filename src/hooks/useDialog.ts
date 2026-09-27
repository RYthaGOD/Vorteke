'use client';
import { useEffect, useRef } from 'react';

export function useDialog(open: boolean, onClose: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        ref.current?.focus();
        const handleKey = (event: KeyboardEvent) => {
            // Wallet selection is a separate overlay above this dialog.
            if (document.querySelector('.wallet-adapter-modal')) return;
            const overlays = document.querySelectorAll('[aria-modal="true"]');
            if (overlays[overlays.length - 1] !== ref.current) return;
            if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
            if (event.key !== 'Tab') return;
            const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
            const first = items[0], last = items[items.length - 1];
            if (!first) { event.preventDefault(); ref.current?.focus(); }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = overflow;
            if (previous?.isConnected) previous.focus();
        };
    }, [open]);
    return ref;
}
