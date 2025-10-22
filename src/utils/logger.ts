/**
 * Simple logger utility for the MCP server
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.error('[DEBUG]', message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.error('[INFO]', message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.error('[WARN]', message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error('[ERROR]', message, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Set from environment variable if available
const logLevel = process.env.LOG_LEVEL?.toUpperCase();
if (logLevel && logLevel in LogLevel) {
  logger.setLevel(LogLevel[logLevel as keyof typeof LogLevel]);
}
