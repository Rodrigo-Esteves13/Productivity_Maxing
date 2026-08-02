import { LoggerService, LogLevel } from '@nestjs/common';

interface LogLine {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message: string;
  // Only present for error()/its overload with a stack/trace string - kept
  // as its own field instead of folded into `message` so log processors
  // (Render's log viewer, or anything ingesting Render's log stream
  // later - Datadog, Axiom, etc.) can filter/search on it directly.
  trace?: string;
}

function write(line: LogLine): void {
  // One JSON object per line (NDJSON) - the format every log aggregator
  // (Render's own viewer included) expects, and trivial to grep/jq
  // locally too. Errors/warnings go to stderr, everything else to stdout -
  // same split Node's console.error/console.log already give you, kept
  // intentionally rather than writing everything to one stream.
  const json = JSON.stringify(line);
  if (line.level === 'error' || line.level === 'warn') {
    process.stderr.write(json + '\n');
  } else {
    process.stdout.write(json + '\n');
  }
}

/**
 * Structured (NDJSON) replacement for Nest's default pretty-printed
 * console logger. Same LoggerService interface Nest already calls
 * internally (framework boot messages, route mapping, etc.) and that
 * `new Logger(context)` calls throughout the app already use - swapping
 * it via `app.useLogger(new JsonLogger())` in main.ts changes every
 * existing `this.logger.log(...)` call's OUTPUT FORMAT with no call-site
 * changes needed anywhere else in the codebase.
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    write({ timestamp: new Date().toISOString(), level: 'log', context, message: String(message) });
  }

  error(message: unknown, trace?: string, context?: string): void {
    write({
      timestamp: new Date().toISOString(),
      level: 'error',
      context,
      message: String(message),
      trace,
    });
  }

  warn(message: unknown, context?: string): void {
    write({ timestamp: new Date().toISOString(), level: 'warn', context, message: String(message) });
  }

  debug(message: unknown, context?: string): void {
    write({ timestamp: new Date().toISOString(), level: 'debug', context, message: String(message) });
  }

  verbose(message: unknown, context?: string): void {
    write({ timestamp: new Date().toISOString(), level: 'verbose', context, message: String(message) });
  }
}
