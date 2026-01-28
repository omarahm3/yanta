import { LogFromFrontend } from "../../bindings/yanta/internal/system/service";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogValue = string | number | boolean | null | undefined | Error | Record<string, unknown>;

export function formatLogArgs(args: LogValue[]): {
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

async function logToBackend(level: LogLevel, ...args: LogValue[]) {
	const { message, data } = formatLogArgs(args);

	try {
		await LogFromFrontend(level, message, data);
	} catch (error) {
		// Silently fail if backend logging fails
		console.error("[BackendLogger] Failed to send log to backend:", error);
	}
}

export function logDebug(...args: LogValue[]) {
	console.log(...args);
	logToBackend("debug", ...args);
}

export function logInfo(...args: LogValue[]) {
	console.log(...args);
	logToBackend("info", ...args);
}

export function logWarn(...args: LogValue[]) {
	console.warn(...args);
	logToBackend("warn", ...args);
}

export function logError(...args: LogValue[]) {
	console.error(...args);
	logToBackend("error", ...args);
}

// Legacy wrapper for backward compatibility
export const BackendLogger = {
	formatArgs: formatLogArgs,
	debug: logDebug,
	info: logInfo,
	warn: logWarn,
	error: logError,
};

// Replace console methods to automatically send to backend
const originalError = console.error;
const originalWarn = console.warn;

export function enableBackendLogging() {
	// Only intercept errors and warnings to avoid spamming backend with verbose logs
	// Regular console.log/info remain local and don't trigger RPC calls
	console.error = (...args) => {
		originalError(...args);
		const { message, data } = formatLogArgs(args);
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
		const formattedData = formatLogArgs(args);
		LogFromFrontend("warn", formattedData.message, formattedData.data).catch(() => {});
	};
}
