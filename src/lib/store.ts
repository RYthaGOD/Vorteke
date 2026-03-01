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
        // SILENCE GHOST ERRORS
        if (type === 'error' && (message.match(/^\d+$/) || message.includes('FETCH_FAILURE') || message.includes('401') || message.includes('429'))) {
            console.warn("SILENCEDHUDERROR:", message);
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
