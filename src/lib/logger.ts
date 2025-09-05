import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';

// Log levels with numeric values for comparison
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

// Colour codes for different log levels (for console output)
const LOG_COLOURS = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[37m',  // White
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  [LogLevel.FATAL]: '\x1b[35m'  // Magenta
};

const RESET_COLOUR = '\x1b[0m';

interface LoggerConfig {
  logLevel?: LogLevel;
  logToFile?: boolean;
  logToConsole?: boolean;
  maxFileSize?: number; // in bytes
  maxFiles?: number;    // number of log files to keep
  logDir?: string;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logToFile: boolean;
  private logToConsole: boolean;
  private maxFileSize: number;
  private maxFiles: number;
  private logDir: string;
  private logFile: string;
  private writeStream?: fs.WriteStream;

  private constructor(config: LoggerConfig = {}) {
    // Default configuration
    this.logLevel = config.logLevel ?? (process.env.GH_MANAGER_DEBUG === '1' ? LogLevel.DEBUG : LogLevel.INFO);
    this.logToFile = config.logToFile ?? true;
    this.logToConsole = config.logToConsole ?? (process.env.GH_MANAGER_DEBUG === '1');
    this.maxFileSize = config.maxFileSize ?? (5 * 1024 * 1024); // 5MB default
    this.maxFiles = config.maxFiles ?? 5;
    
    // Set up log directory - pass empty suffix to avoid '-nodejs' being appended
    const paths = envPaths('gh-manager-cli', { suffix: '' });
    this.logDir = config.logDir ?? paths.log;
    
    // Ensure log directory exists
    if (this.logToFile) {
      fs.mkdirSync(this.logDir, { recursive: true });
      this.logFile = path.join(this.logDir, 'gh-manager-cli.log');
      this.initLogFile();
    } else {
      this.logFile = '';
    }
  }

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private initLogFile(): void {
    try {
      // Check if log rotation is needed
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size >= this.maxFileSize) {
          this.rotateLogFiles();
        }
      }
      
      // Create write stream with append mode
      this.writeStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    } catch (error) {
      // If we can't create log file, disable file logging
      this.logToFile = false;
      console.error('Failed to initialise log file:', error);
    }
  }

  private rotateLogFiles(): void {
    try {
      // Close current stream if exists
      if (this.writeStream) {
        this.writeStream.end();
      }

      // Rotate existing log files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = i === 1 ? this.logFile : `${this.logFile}.${i - 1}`;
        const newFile = `${this.logFile}.${i}`;
        
        if (fs.existsSync(oldFile)) {
          if (fs.existsSync(newFile)) {
            fs.unlinkSync(newFile);
          }
          fs.renameSync(oldFile, newFile);
        }
      }
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
  }

  private getLevelName(level: LogLevel): string {
    const names = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    return names[level] || 'UNKNOWN';
  }

  private formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = this.formatTimestamp();
    const levelName = this.getLevelName(level);
    const paddedLevel = levelName.padEnd(5);
    
    let formattedMessage = `[${timestamp}] [${paddedLevel}] ${message}`;
    
    if (context !== undefined) {
      try {
        const contextStr = typeof context === 'object' 
          ? JSON.stringify(context, null, 2)
          : String(context);
        formattedMessage += `\n${contextStr}`;
      } catch (error) {
        formattedMessage += '\n[Unable to serialise context]';
      }
    }
    
    return formattedMessage;
  }

  private log(level: LogLevel, message: string, context?: any): void {
    // Check if we should log this level
    if (level < this.logLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, context);

    // Log to console if enabled
    if (this.logToConsole) {
      const colour = LOG_COLOURS[level];
      console.log(`${colour}${formattedMessage}${RESET_COLOUR}`);
    }

    // Log to file if enabled
    if (this.logToFile && this.writeStream) {
      this.writeStream.write(formattedMessage + '\n');
      
      // Check file size and rotate if needed
      const stats = fs.statSync(this.logFile);
      if (stats.size >= this.maxFileSize) {
        this.rotateLogFiles();
        this.initLogFile();
      }
    }
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }

  fatal(message: string, context?: any): void {
    this.log(LogLevel.FATAL, message, context);
  }

  // Method to get log file path
  getLogFilePath(): string {
    return this.logFile;
  }

  // Method to get all log files
  getLogFiles(): string[] {
    if (!this.logToFile) return [];
    
    const files: string[] = [];
    if (fs.existsSync(this.logFile)) {
      files.push(this.logFile);
    }
    
    for (let i = 1; i < this.maxFiles; i++) {
      const rotatedFile = `${this.logFile}.${i}`;
      if (fs.existsSync(rotatedFile)) {
        files.push(rotatedFile);
      }
    }
    
    return files;
  }

  // Clean up method
  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = undefined;
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export Logger class for testing or custom instances
export default Logger;