/**
 * Structured logging. On the server, lines go to Railway's logs as JSON. In the browser, errors
 * are also sent to /api/client-error so they show up in the same logs.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogContext {
    wallet?: string;
    mint?: string;
    signature?: string;
    [key: string]: unknown;
}

export const logger = {
    info: (msg: string, context?: LogContext) => log('INFO', msg, context),
    warn: (msg: string, context?: LogContext) => log('WARN', msg, context),
    error: (msg: string, context?: LogContext) => log('ERROR', msg, context),
    fatal: (msg: string, context?: LogContext) => log('FATAL', msg, context),
};

function log(level: LogLevel, message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
    } else {
        const color = level === 'ERROR' || level === 'FATAL' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[36m';
        console.log(`${color}[${level}]\x1b[0m ${message}`, context || '');
    }
}

// At most a few reports per page load, so a render loop can't flood the endpoint.
let reportsLeft = 5;

/** Logs an error, and from the browser reports it to the server log as well. */
export const captureException = (error: Error, context?: LogContext) => {
    logger.error(error.message, { stack: error.stack, ...context });
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production' || reportsLeft <= 0) return;
    reportsLeft--;
    const body = JSON.stringify({ message: error.message, stack: error.stack?.slice(0, 2000), context, path: window.location.pathname });
    try { navigator.sendBeacon?.('/api/client-error', new Blob([body], { type: 'application/json' })); } catch { /* best effort */ }
};
