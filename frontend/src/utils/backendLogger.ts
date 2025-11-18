import { LogFromFrontend } from "../../bindings/yanta/internal/system/service";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogValue = string | number | boolean | null | undefined | Error | Record<string, unknown>;

export class BackendLogger {
	static formatArgs(args: LogValue[]): {
		message: string;
		data: Record<string, unknown>;
	} {
		const message = args
			.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
			.join(" ");

		const data: Record<string, unknown> = {};
		args.forEach((arg) => {
			if (typeof arg === "object" && arg !== null) {
				Object.assign(data, arg);
			}
		});

		return { message, data };
	}

	private static async log(level: LogLevel, ...args: LogValue[]) {
		const { message, data } = BackendLogger.formatArgs(args);

		try {
			await LogFromFrontend(level, message, data);
		} catch (error) {
			// Silently fail if backend logging fails
			console.error("[BackendLogger] Failed to send log to backend:", error);
		}
	}

	static debug(...args: LogValue[]) {
		console.log(...args);
		BackendLogger.log("debug", ...args);
	}

	static info(...args: LogValue[]) {
		console.log(...args);
		BackendLogger.log("info", ...args);
	}

	static warn(...args: LogValue[]) {
		console.warn(...args);
		BackendLogger.log("warn", ...args);
	}

	static error(...args: LogValue[]) {
		console.error(...args);
		BackendLogger.log("error", ...args);
	}
}

// Replace console methods to automatically send to backend
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

export function enableBackendLogging() {
	// Only intercept errors and warnings to avoid spamming backend with verbose logs
	// Regular console.log/info remain local and don't trigger RPC calls
	console.error = (...args) => {
		originalError(...args);
		const { message, data } = BackendLogger.formatArgs(args);
		LogFromFrontend("error", message, data).catch(() => {});
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
		const formattedData = BackendLogger.formatArgs(args);
		LogFromFrontend("warn", formattedData.message, formattedData.data).catch(() => {});
	};
}
