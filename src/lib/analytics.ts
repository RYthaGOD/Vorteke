// The project funnel, counted per day without any user data.
export const FUNNEL_EVENTS = ['token_view', 'claim_started', 'claim_done', 'payment_started', 'paid'] as string[];

const sent = new Set<string>();

/** Records a funnel step. `onceKey` limits a step to once per page session (for example one view per token). */
export function trackEvent(name: string, onceKey?: string) {
    if (typeof window === 'undefined' || !FUNNEL_EVENTS.includes(name)) return;
    const key = name + ':' + (onceKey ?? Math.random());
    if (sent.has(key)) return;
    sent.add(key);
    try {
        const body = new Blob([JSON.stringify({ name })], { type: 'application/json' });
        if (!navigator.sendBeacon?.('/api/event', body)) void fetch('/api/event', { method: 'POST', body, keepalive: true });
    } catch { /* best effort */ }
}
