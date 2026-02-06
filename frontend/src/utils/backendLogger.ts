import { LogFromFrontend } from "../../bindings/yanta/internal/system/service";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogValue = string | number | boolean | null | undefined | Error | Record<string, unknown>;

export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
}

const LOG_BUFFER_SIZE = 200;
const logBuffer: LogEntry[] = [];

function pushEntry(level: LogLevel, message: string) {
	logBuffer.push({ level, message, timestamp: new Date().toISOString() });
	if (logBuffer.length > LOG_BUFFER_SIZE) {
		logBuffer.shift();
	}
}

export function getLogBuffer(): readonly LogEntry[] {
	return logBuffer;
}

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

export const BackendLogger = {
	formatArgs: formatLogArgs,
	debug: logDebug,
	info: logInfo,
	warn: logWarn,
	error: logError,
};

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

export function enableBackendLogging() {
	console.log = (...args) => {
		originalLog(...args);
		const { message } = formatLogArgs(args);
		pushEntry("info", message);
	};

	console.error = (...args) => {
		originalError(...args);
		const { message, data } = formatLogArgs(args);
		pushEntry("error", message);
		LogFromFrontend("error", message, data).catch(() => {});
	};

	console.warn = (...args) => {
		const message = args[0]?.toString() || "";

		if (
			message.includes("Function components cannot be given refs") &&
			message.includes("ForwardRef")
		) {
			return;
		}

		originalWarn(...args);
		const formattedData = formatLogArgs(args);
		pushEntry("warn", formattedData.message);
		LogFromFrontend("warn", formattedData.message, formattedData.data).catch(() => {});
	};
}
