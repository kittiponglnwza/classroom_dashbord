// Log levels ordered by severity
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

class Logger {
  constructor() {
    this.level = 'info'; // Default level
    this.isRemoteEnabled = false;
  }

  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = level;
    }
  }

  shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
      this.logToRemote(message, args);
    }
  }

  logToRemote(message, args) {
    if (this.isRemoteEnabled) {
      // Mock remote logger endpoint
      // fetch('/api/log', { method: 'POST', body: JSON.stringify({ message, args }) }).catch(() => {});
    }
  }
}

export const logger = new Logger();
