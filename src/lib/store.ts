import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
    id: number;
    type: NotificationType;
    message: string;
}

interface NotificationStore {
    notifications: Notification[];
    notify: (type: NotificationType, message: string) => void;
    dismiss: (id: number) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    notify: (type, message) => {
        // Suppress non-actionable numeric-only error codes (e.g. raw status codes)
        if (type === 'error' && message.match(/^\d+$/)) {
            console.warn("SILENCED_NUMERIC_ERROR:", message);
            return;
        }

        const notifications = get().notifications;
        if (type === 'error' && notifications.some(n => n.message === message)) return;

        const id = Date.now();
        set((state) => ({
            notifications: [...state.notifications, { id, type, message }]
        }));

        setTimeout(() => {
            get().dismiss(id);
        }, 5000);
    },
    dismiss: (id) => {
        set((state) => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }));
    }
}));

// H4 FIX: Removed 3-arg `notify(title, message, type)` export — it was the root cause of C2/C3.
// Outside React components, use: useNotificationStore.getState().notify(type, message)

