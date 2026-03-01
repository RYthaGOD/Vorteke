/**
 * Vortex Observability Layer
 * Centralized logging for production-grade error tracking.
 * Can be swapped for Sentry, Axiom, or Datadog.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogContext {
    wallet?: string;
    mint?: string;
    signature?: string;
    [key: string]: any;
}

export const logger = {
    info: (msg: string, context?: LogContext) => log('INFO', msg, context),
    warn: (msg: string, context?: LogContext) => log('WARN', msg, context),
    error: (msg: string, context?: LogContext) => log('ERROR', msg, context),
    fatal: (msg: string, context?: LogContext) => log('FATAL', msg, context),
};

function log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const payload = {
        timestamp,
        level,
        message,
        ...context,
        vortex_version: '1.0.0-recon',
    };

    // In production, this would ship to an external aggregator
    if (process.env.NODE_ENV === 'production') {
        // Example: Sentry.captureMessage(message, { level, extra: context });
        console.log(JSON.stringify(payload));
    } else {
        // Pretty print for development
        const color = level === 'ERROR' || level === 'FATAL' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[36m';
        console.log(`${color}[${level}]\x1b[0m ${message}`, context || '');
    }
}

/**
 * Global Error Boundary Helper
 */
export const captureException = (error: Error, context?: LogContext) => {
    logger.error(error.message, {
        stack: error.stack,
        ...context
    });

    // In production, ship to Sentry
    if (process.env.NODE_ENV === 'production') {
        // Sentry.captureException(error, { extra: context });
    }
};
