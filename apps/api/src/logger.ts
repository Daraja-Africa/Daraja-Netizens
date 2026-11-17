/**
 * Minimal structured logger.
 *
 * Every line is one JSON object with the request id attached, so a log drain
 * can join a user-facing error message to the exact request that produced it.
 * `console.error` alone gave us no request id and nothing a collector could
 * parse, which is why the roadmap made this a Phase 0 gate.
 */

type Level = 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export type Logger = {
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
  child: (fields: LogFields) => Logger;
};

function write(level: Level, message: string, fields: LogFields) {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

/** Drops `undefined` and `Error` objects into something JSON can hold. */
function normalise(fields: LogFields): LogFields {
  const output: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    output[key] = value instanceof Error ? { name: value.name, message: value.message } : value;
  }
  return output;
}

export function createLogger(base: LogFields = {}): Logger {
  const bound = normalise(base);
  return {
    info: (message, fields) => write('info', message, { ...bound, ...normalise(fields ?? {}) }),
    warn: (message, fields) => write('warn', message, { ...bound, ...normalise(fields ?? {}) }),
    error: (message, fields) => write('error', message, { ...bound, ...normalise(fields ?? {}) }),
    child: (fields) => createLogger({ ...bound, ...fields }),
  };
}

export const logger = createLogger({ service: 'daraja-api' });
