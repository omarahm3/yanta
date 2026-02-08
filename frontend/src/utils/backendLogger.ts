import { LogFromFrontend } from "../../bindings/yanta/internal/system/service";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Error
	| Record<string, unknown>
	| unknown;

export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
}

const LOG_BUFFER_SIZE = 200;
const logBuffer: LogEntry[] = [];

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/** Minimum level to forward to backend and buffer. Below this, logs are no-ops. */
function getMinLevel(): LogLevel {
	const env = import.meta.env.VITE_LOG_LEVEL as string | undefined;
	if (env && ["debug", "info", "warn", "error"].includes(env)) return env as LogLevel;
	return import.meta.env.PROD ? "warn" : "debug";
}

const minLevel = getMinLevel();

function shouldLog(level: LogLevel): boolean {
	return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function pushEntry(level: LogLevel, message: string) {
	if (!shouldLog(level)) return;
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

/** Sends pre-formatted message/data to backend. Call formatLogArgs once at call site to avoid duplicate work (js-cache-function-results). */
async function sendToBackend(level: LogLevel, message: string, data: Record<string, unknown>) {
	if (!shouldLog(level)) return;
	try {
		await LogFromFrontend(level, message, data);
	} catch (error) {
		originalError("[BackendLogger] Failed to send log to backend:", error);
	}
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

export function logDebug(...args: LogValue[]) {
	if (!shouldLog("debug")) return;
	const { message, data } = formatLogArgs(args);
	originalLog(...args);
	pushEntry("debug", message);
	sendToBackend("debug", message, data);
}

export function logInfo(...args: LogValue[]) {
	if (!shouldLog("info")) return;
	const { message, data } = formatLogArgs(args);
	originalLog(...args);
	pushEntry("info", message);
	sendToBackend("info", message, data);
}

export function logWarn(...args: LogValue[]) {
	if (!shouldLog("warn")) return;
	const { message, data } = formatLogArgs(args);
	originalWarn(...args);
	pushEntry("warn", message);
	sendToBackend("warn", message, data);
}

export function logError(...args: LogValue[]) {
	const { message, data } = formatLogArgs(args);
	originalError(...args);
	pushEntry("error", message);
	sendToBackend("error", message, data);
}

export const BackendLogger = {
	formatArgs: formatLogArgs,
	debug: logDebug,
	info: logInfo,
	warn: logWarn,
	error: logError,
};

export function enableBackendLogging() {
	console.log = (...args) => {
		originalLog(...args);
		if (!shouldLog("info")) return;
		const { message, data } = formatLogArgs(args);
		pushEntry("info", message);
		LogFromFrontend("info", message, data).catch(() => {});
	};

	console.error = (...args) => {
		originalError(...args);
		const { message, data } = formatLogArgs(args);
		pushEntry("error", message);
		LogFromFrontend("error", message, data).catch(() => {});
	};

	console.warn = (...args) => {
		const rawMessage = args[0]?.toString() || "";
		if (
			rawMessage.includes("Function components cannot be given refs") &&
			rawMessage.includes("ForwardRef")
		) {
			return;
		}
		originalWarn(...args);
		if (!shouldLog("warn")) return;
		const { message, data } = formatLogArgs(args);
		pushEntry("warn", message);
		LogFromFrontend("warn", message, data).catch(() => {});
	};
}
