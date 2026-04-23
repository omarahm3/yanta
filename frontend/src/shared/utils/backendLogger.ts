import { LogFromFrontend } from "../../../bindings/yanta/internal/system/service";

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
const MAX_MESSAGE_LENGTH = 2000;
const MAX_DATA_FIELDS = 20;
const MAX_STRING_VALUE_LENGTH = 400;
const RATE_LIMIT_WINDOW_MS = 10_000;
const logBuffer: LogEntry[] = [];
const signatureLastSentAt = new Map<string, number>();
let pendingLogTracker: ((delta: 1 | -1) => void) | null = null;

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
	const rawMessage = args
		.map((arg) => {
			if (arg instanceof Error) return formatErrorForMessage(arg);
			if (typeof arg === "object") return safeStringify(arg);
			return String(arg);
		})
		.join(" ");
	const message = clampString(rawMessage, MAX_MESSAGE_LENGTH);

	const data: Record<string, unknown> = {};
	let errorIndex = 0;
	args.forEach((arg) => {
		if (arg instanceof Error) {
			const key = errorIndex === 0 ? "error" : `error_${errorIndex}`;
			data[key] = serializeError(arg);
			errorIndex += 1;
			return;
		}
		if (typeof arg === "object" && arg !== null) {
			Object.assign(data, arg);
		}
	});

	return { message, data: sanitizeData(data) };
}

function serializeError(err: Error): Record<string, unknown> {
	const out: Record<string, unknown> = {
		name: err.name,
		message: err.message,
	};
	if (err.stack) out.stack = err.stack;
	const cause = (err as { cause?: unknown }).cause;
	if (cause !== undefined) {
		out.cause = cause instanceof Error ? serializeError(cause) : cause;
	}
	return out;
}

function formatErrorForMessage(err: Error): string {
	const head = `${err.name || "Error"}: ${err.message || "(no message)"}`;
	return err.stack ? `${head}\n${err.stack}` : head;
}

/** Sends pre-formatted message/data to backend. Call formatLogArgs once at call site to avoid duplicate work (js-cache-function-results). */
async function sendToBackend(level: LogLevel, message: string, data: Record<string, unknown>) {
	if (!shouldLog(level)) return;
	const signature = `${level}:${message}`;
	if (isRateLimited(level, signature)) {
		return;
	}
	pendingLogTracker?.(1);
	try {
		await LogFromFrontend(level, message, data);
	} catch (error) {
		originalError("[BackendLogger] Failed to send log to backend:", error);
	} finally {
		pendingLogTracker?.(-1);
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

export function setBackendLogPendingTracker(tracker: ((delta: 1 | -1) => void) | null) {
	pendingLogTracker = tracker;
}

export function enableBackendLogging() {
	const allowProdConsoleForwarding = import.meta.env.VITE_ENABLE_CONSOLE_FORWARDING === "true";
	if (import.meta.env.PROD && !allowProdConsoleForwarding) {
		return;
	}

	console.log = (...args) => {
		originalLog(...args);
		// Intentionally never forward console.log to backend.
		// Dev tooling (HMR, warnings, verbose libs) can generate high-volume logs.
	};

	console.error = (...args) => {
		originalError(...args);
		const { message, data } = formatLogArgs(args);
		pushEntry("error", message);
		sendToBackend("error", message, data);
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
		sendToBackend("warn", message, data);
	};
}

function clampString(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`;
}

const MAX_STACK_LENGTH = 2000;

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
	const entries = Object.entries(data).slice(0, MAX_DATA_FIELDS);
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of entries) {
		if ((key === "error" || key.startsWith("error_")) && isErrorShape(value)) {
			sanitized[key] = sanitizeErrorShape(value as Record<string, unknown>);
			continue;
		}
		sanitized[key] = sanitizeValue(value, 0);
	}
	const omitted = Object.keys(data).length - entries.length;
	if (omitted > 0) {
		sanitized.__omittedFields = omitted;
	}
	return sanitized;
}

function sanitizeValue(value: unknown, depth: number): unknown {
	if (value == null) {
		return value;
	}
	if (depth > 2) {
		return "[depth-limited]";
	}
	if (typeof value === "string") {
		return clampString(value, MAX_STRING_VALUE_LENGTH);
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	if (value instanceof Error) {
		return {
			name: value.name,
			message: clampString(value.message, MAX_STRING_VALUE_LENGTH),
		};
	}
	if (Array.isArray(value)) {
		const maxItems = 10;
		const limited = value.slice(0, maxItems).map((item) => sanitizeValue(item, depth + 1));
		if (value.length > maxItems) {
			limited.push(`[${value.length - maxItems} more items]`);
		}
		return limited;
	}
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(obj).slice(0, 10)) {
			out[k] = sanitizeValue(v, depth + 1);
		}
		const omitted = Object.keys(obj).length - Object.keys(out).length;
		if (omitted > 0) {
			out.__omittedFields = omitted;
		}
		return out;
	}
	return String(value);
}

function isRateLimited(level: LogLevel, signature: string): boolean {
	if (level === "debug" || level === "info") {
		return false;
	}
	const now = Date.now();
	const last = signatureLastSentAt.get(signature);
	if (last && now - last < RATE_LIMIT_WINDOW_MS) {
		return true;
	}
	if (signatureLastSentAt.size > 500) {
		signatureLastSentAt.clear();
	}
	signatureLastSentAt.set(signature, now);
	return false;
}

function isErrorShape(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { message?: unknown }).message === "string"
	);
}

function sanitizeErrorShape(value: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (typeof value.name === "string") out.name = clampString(value.name, 200);
	if (typeof value.message === "string") out.message = clampString(value.message, MAX_MESSAGE_LENGTH);
	if (typeof value.stack === "string") out.stack = clampString(value.stack, MAX_STACK_LENGTH);
	if (value.cause !== undefined) {
		out.cause = isErrorShape(value.cause)
			? sanitizeErrorShape(value.cause as Record<string, unknown>)
			: sanitizeValue(value.cause, 0);
	}
	return out;
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return `[unserializable:${typeof value}]`;
	}
}
