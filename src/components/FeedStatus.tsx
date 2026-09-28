'use client';
import { useEffect, useState } from 'react';
import { WifiOff, Radio, AlertCircle } from 'lucide-react';

export function FeedStatus({ updatedAt, fetching = false, error = false }: { updatedAt: number; fetching?: boolean; error?: boolean }) {
    const [now, setNow] = useState(0);
    const [offline, setOffline] = useState(false);
    useEffect(() => {
        const update = () => { setNow(Date.now()); setOffline(!navigator.onLine); };
        update();
        const timer = setInterval(update, 10000);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => { clearInterval(timer); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }, []);
    const age = updatedAt && now ? Math.max(0, Math.floor((now - updatedAt) / 1000)) : 0;
    const stale = !!updatedAt && age > 120;
    const label = offline ? 'Offline · reconnect to update' : error ? 'Update failed · retry' : fetching ? 'Refreshing market data' : stale ? 'Data may be stale' : updatedAt ? 'Auto-refresh on' : 'Connecting to market data';
    const Icon = offline ? WifiOff : error || stale ? AlertCircle : Radio;
    return <span className="vortex-feed-status" data-state={offline || error || stale ? 'warning' : updatedAt ? 'ready' : 'loading'} title={updatedAt ? 'Last successful fetch: ' + new Date(updatedAt).toLocaleTimeString() + '. Provider data may be cached.' : undefined}>
        <Icon size={14} aria-hidden /><span>{label}</span>{updatedAt > 0 && !offline && <small>Fetched {age < 60 ? age + 's' : Math.floor(age / 60) + 'm'} ago</small>}
    </span>;
}
