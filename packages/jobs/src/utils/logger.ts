type LogLevel = "debug" | "info" | "warning" | "error";

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warning", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string) {
    if (this.shouldLog("debug")) {
      console.log(this.format("debug", message));
    }
  }

  info(message: string) {
    if (this.shouldLog("info")) {
      console.log(this.format("info", message));
    }
  }

  warning(message: string) {
    if (this.shouldLog("warning")) {
      console.warn(this.format("warning", message));
    }
  }

  error(message: string) {
    if (this.shouldLog("error")) {
      console.error(this.format("error", message));
    }
  }
}

export const logger = new Logger();
