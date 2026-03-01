'use client';
import React from 'react';
import { Check, AlertTriangle, Info } from 'lucide-react';
import { useNotificationStore } from '@/lib/store';

export function GlobalNotification() {
    const notifications = useNotificationStore((state) => state.notifications);

    if (notifications.length === 0) return null;
    return (
        <div className="vortex-notification-container" suppressHydrationWarning>
            {notifications.map(n => (
                <div key={n.id} className={`vortex-notification ${n.type}`} suppressHydrationWarning>
                    <div className="notification-scanline"></div>
                    {n.type === 'success' ? <Check size={18} className="text-vortex-yellow" /> :
                        n.type === 'error' ? <AlertTriangle size={18} className="text-vortex-red" /> :
                            <Info size={18} className="text-vortex-cyan" />}
                    <div className="vortex-font-mono vortex-text-xs vortex-ls-wide">
                        <div className="vortex-text-bold vortex-mb-1">
                            {n.type === 'success' ? 'SYSTEM: SUCCESS' : n.type === 'error' ? 'SYSTEM: FAIL' : 'SYSTEM: INFO'}
                        </div>
                        <div className="vortex-opacity-80">{n.message}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
