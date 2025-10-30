import { LogFromFrontend } from "../../wailsjs/go/system/Service";

type LogLevel = "debug" | "info" | "warn" | "error";

export class BackendLogger {
  private static formatArgs(args: any[]): {
    message: string;
    data: Record<string, any>;
  } {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg),
      )
      .join(" ");

    const data: Record<string, any> = {};
    args.forEach((arg, index) => {
      if (typeof arg === "object" && arg !== null) {
        Object.assign(data, arg);
      }
    });

    return { message, data };
  }

  private static async log(level: LogLevel, ...args: any[]) {
    const { message, data } = this.formatArgs(args);

    try {
      await LogFromFrontend(level, message, data);
    } catch (error) {
      // Silently fail if backend logging fails
      console.error("[BackendLogger] Failed to send log to backend:", error);
    }
  }

  static debug(...args: any[]) {
    console.log(...args); // Also log to console
    this.log("debug", ...args);
  }

  static info(...args: any[]) {
    console.log(...args);
    this.log("info", ...args);
  }

  static warn(...args: any[]) {
    console.warn(...args);
    this.log("warn", ...args);
  }

  static error(...args: any[]) {
    console.error(...args);
    this.log("error", ...args);
  }
}

// Replace console methods to automatically send to backend
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

export function enableBackendLogging() {
  console.log = (...args) => {
    originalLog(...args);
    const { message, data } = BackendLogger["formatArgs"](args);
    LogFromFrontend("info", message, data).catch(() => { });
  };

  console.info = (...args) => {
    originalInfo(...args);
    const { message, data } = BackendLogger["formatArgs"](args);
    LogFromFrontend("info", message, data).catch(() => { });
  };

  console.error = (...args) => {
    originalError(...args);
    const { message, data } = BackendLogger["formatArgs"](args);
    LogFromFrontend("error", message, data).catch(() => { });
  };

  console.warn = (...args) => {
    const message = args[0]?.toString() || "";

    // Suppress known library warnings
    if (
      message.includes("Function components cannot be given refs") &&
      message.includes("ForwardRef")
    ) {
      // Known issue with @blocknote/shadcn and Radix UI components
      // See: https://github.com/radix-ui/primitives/discussions/1957
      return;
    }

    originalWarn(...args);
    const formattedData = BackendLogger["formatArgs"](args);
    LogFromFrontend("warn", formattedData.message, formattedData.data).catch(
      () => { },
    );
  };
}
