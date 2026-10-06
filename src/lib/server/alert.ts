/**
 * Sends an operational alert to ALERT_WEBHOOK_URL (a Discord or Slack incoming webhook) and logs
 * it. Without the variable set, the alert is only logged. Never throws.
 */
export async function sendAlert(title: string, details: Record<string, unknown> = {}) {
    const line = `VORTEX alert: ${title}` + (Object.keys(details).length ? '\n' + Object.entries(details).map(([k, v]) => `${k}: ${String(v)}`).join('\n') : '');
    console.error(JSON.stringify({ level: 'ALERT', title, ...details, timestamp: new Date().toISOString() }));
    const url = process.env.ALERT_WEBHOOK_URL;
    if (!url) return;
    try {
        // Discord reads `content`, Slack reads `text`.
        await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: line.slice(0, 1900), text: line.slice(0, 1900) }),
            signal: AbortSignal.timeout(5000),
        });
    } catch (error) {
        console.error('ALERT_DELIVERY_FAILED', error);
    }
}
