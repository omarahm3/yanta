import { BackendLogger, setBackendLogPendingTracker } from "../utils/backendLogger";

const SAMPLE_INTERVAL_MS = 10_000;
const LOG_INTERVAL_MS = 60_000;
const MAX_SAMPLES = 180;
const SESSION_STORAGE_KEY = "yanta_app_monitor_session";

type MemoryData = {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
};

export interface AppMonitorSample {
	timestamp: number;
	heapUsedBytes: number | null;
	heapTotalBytes: number | null;
	heapLimitBytes: number | null;
	documentGetCalls: number;
	documentGetErrors: number;
	documentGetInFlight: number;
	documentGetAvgMs: number;
}

export interface AppMonitorSnapshot {
	startedAt: number | null;
	lastSampleAt: number | null;
	uptimeMs: number;
	documentGetCalls: number;
	documentGetErrors: number;
	documentGetInFlight: number;
	documentGetAvgMs: number;
	pendingBackendLogs: number;
	inFlightCommands: {
		syncNow: number;
		gitPull: number;
		gitStatus: number;
	};
	lastGitCommandAt: number | null;
	lastSample: AppMonitorSample | null;
	samples: AppMonitorSample[];
}

type YantaMonitorDebug = {
	getSnapshot: () => AppMonitorSnapshot;
	clearSamples: () => void;
	isRunning: () => boolean;
};

declare global {
	interface Window {
		__YANTA_MONITOR__?: YantaMonitorDebug;
	}
}

const state = {
	startedAt: null as number | null,
	sessionId: null as string | null,
	lastSampleAt: null as number | null,
	documentGetCalls: 0,
	documentGetErrors: 0,
	documentGetInFlight: 0,
	documentGetTotalDurationMs: 0,
	pendingBackendLogs: 0,
	inFlightCommands: {
		syncNow: 0,
		gitPull: 0,
		gitStatus: 0,
	},
	lastGitCommandAt: null as number | null,
	largeHeapJumpCount: 0,
	lastLargeHeapWarningAt: 0,
	suppressSnapshotLogs: false,
	samples: [] as AppMonitorSample[],
	sampleTimer: null as ReturnType<typeof setInterval> | null,
	logTimer: null as ReturnType<typeof setInterval> | null,
	exitHandler: null as (() => void) | null,
	running: false,
};

type StoredMonitorSession = {
	sessionId: string;
	startedAt: number;
	lastHeartbeatAt: number;
	cleanShutdown: boolean;
	lastHeapUsedBytes: number | null;
	lastDocumentGetCalls: number;
	lastDocumentGetErrors: number;
};

function readStoredSession(): StoredMonitorSession | null {
	try {
		const raw = localStorage.getItem(SESSION_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as StoredMonitorSession;
	} catch {
		return null;
	}
}

function writeStoredSession(data: StoredMonitorSession) {
	try {
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
	} catch {
		// best effort
	}
}

function updateStoredSession(cleanShutdown: boolean) {
	if (!state.sessionId || !state.startedAt) return;
	const last = state.samples[state.samples.length - 1] ?? null;
	writeStoredSession({
		sessionId: state.sessionId,
		startedAt: state.startedAt,
		lastHeartbeatAt: Date.now(),
		cleanShutdown,
		lastHeapUsedBytes: last?.heapUsedBytes ?? null,
		lastDocumentGetCalls: state.documentGetCalls,
		lastDocumentGetErrors: state.documentGetErrors,
	});
}

function getMemoryData(): MemoryData | null {
	if (typeof performance === "undefined") {
		return null;
	}
	const perfWithMemory = performance as Performance & { memory?: MemoryData };
	if (!perfWithMemory.memory) {
		return null;
	}
	return perfWithMemory.memory;
}

function toMb(bytes: number | null): number | null {
	if (bytes === null) {
		return null;
	}
	return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function buildSample(): AppMonitorSample {
	const memory = getMemoryData();
	const documentGetAvgMs =
		state.documentGetCalls > 0
			? Math.round((state.documentGetTotalDurationMs / state.documentGetCalls) * 100) / 100
			: 0;

	return {
		timestamp: Date.now(),
		heapUsedBytes: memory?.usedJSHeapSize ?? null,
		heapTotalBytes: memory?.totalJSHeapSize ?? null,
		heapLimitBytes: memory?.jsHeapSizeLimit ?? null,
		documentGetCalls: state.documentGetCalls,
		documentGetErrors: state.documentGetErrors,
		documentGetInFlight: state.documentGetInFlight,
		documentGetAvgMs,
	};
}

function recordSample() {
	const sample = buildSample();
	state.lastSampleAt = sample.timestamp;
	state.samples.push(sample);
	if (state.samples.length > MAX_SAMPLES) {
		state.samples.shift();
	}

	const prev = state.samples[state.samples.length - 2];
	if (prev && sample.heapUsedBytes !== null && prev.heapUsedBytes !== null) {
		const delta = sample.heapUsedBytes - prev.heapUsedBytes;
		const deltaMb = delta / (1024 * 1024);
		if (deltaMb > 120) {
			state.largeHeapJumpCount += 1;
			const now = sample.timestamp;
			const warningCooldownMs = 30_000;
			const suppressionThreshold = 5;
			if (state.largeHeapJumpCount >= suppressionThreshold) {
				state.suppressSnapshotLogs = true;
			}
			if (now - state.lastLargeHeapWarningAt < warningCooldownMs) {
				updateStoredSession(false);
				return;
			}
			state.lastLargeHeapWarningAt = now;
			BackendLogger.warn("[AppMonitor] Large heap jump detected", {
				prevHeapMb: toMb(prev.heapUsedBytes),
				nextHeapMb: toMb(sample.heapUsedBytes),
				deltaMb: Math.round(deltaMb * 10) / 10,
				documentGetInFlight: sample.documentGetInFlight,
				largeHeapJumpCount: state.largeHeapJumpCount,
				snapshotLoggingSuppressed: state.suppressSnapshotLogs,
			});
		}
	}
	updateStoredSession(false);
}

function logSnapshot() {
	if (state.suppressSnapshotLogs) {
		return;
	}
	const snapshot = getAppMonitorSnapshot();
	const last = snapshot.lastSample;

	BackendLogger.info("[AppMonitor] Snapshot", {
		uptimeMs: snapshot.uptimeMs,
		heapUsedMb: toMb(last?.heapUsedBytes ?? null),
		heapTotalMb: toMb(last?.heapTotalBytes ?? null),
		heapLimitMb: toMb(last?.heapLimitBytes ?? null),
		documentGetCalls: snapshot.documentGetCalls,
		documentGetErrors: snapshot.documentGetErrors,
		documentGetInFlight: snapshot.documentGetInFlight,
		documentGetAvgMs: snapshot.documentGetAvgMs,
		pendingBackendLogs: snapshot.pendingBackendLogs,
		inFlightSyncNow: snapshot.inFlightCommands.syncNow,
		inFlightGitPull: snapshot.inFlightCommands.gitPull,
		inFlightGitStatus: snapshot.inFlightCommands.gitStatus,
		lastGitCommandAt: snapshot.lastGitCommandAt,
		sampleCount: snapshot.samples.length,
	});
}

function attachDebugApi() {
	if (typeof window === "undefined") {
		return;
	}
	window.__YANTA_MONITOR__ = {
		getSnapshot: getAppMonitorSnapshot,
		clearSamples: () => {
			state.samples = [];
			state.lastSampleAt = null;
		},
		isRunning: () => state.running,
	};
}

export function startAppMonitor(): () => void {
	if (state.running) {
		return () => stopAppMonitor();
	}

	const previousSession = readStoredSession();
	if (previousSession && !previousSession.cleanShutdown) {
		BackendLogger.warn("[AppMonitor] Previous session ended unexpectedly", {
			sessionId: previousSession.sessionId,
			startedAt: previousSession.startedAt,
			lastHeartbeatAt: previousSession.lastHeartbeatAt,
			lastHeapUsedMb: toMb(previousSession.lastHeapUsedBytes),
			lastDocumentGetCalls: previousSession.lastDocumentGetCalls,
			lastDocumentGetErrors: previousSession.lastDocumentGetErrors,
		});
	}

	state.running = true;
	state.startedAt = Date.now();
	state.sessionId = `${state.startedAt}-${Math.random().toString(16).slice(2, 10)}`;
	attachDebugApi();
	recordSample();
	updateStoredSession(false);

	const markCleanExit = () => {
		updateStoredSession(true);
	};
	window.addEventListener("beforeunload", markCleanExit);
	window.addEventListener("pagehide", markCleanExit);
	state.exitHandler = markCleanExit;

	state.sampleTimer = setInterval(recordSample, SAMPLE_INTERVAL_MS);
	state.logTimer = setInterval(logSnapshot, LOG_INTERVAL_MS);

	BackendLogger.info("[AppMonitor] started", {
		sampleIntervalMs: SAMPLE_INTERVAL_MS,
		logIntervalMs: LOG_INTERVAL_MS,
	});

	return () => stopAppMonitor();
}

export function stopAppMonitor() {
	if (!state.running) {
		return;
	}
	if (state.sampleTimer) {
		clearInterval(state.sampleTimer);
		state.sampleTimer = null;
	}
	if (state.logTimer) {
		clearInterval(state.logTimer);
		state.logTimer = null;
	}
	if (state.exitHandler) {
		window.removeEventListener("beforeunload", state.exitHandler);
		window.removeEventListener("pagehide", state.exitHandler);
		state.exitHandler = null;
	}
	state.running = false;
	updateStoredSession(true);
	BackendLogger.info("[AppMonitor] stopped");
}

export function recordDocumentGetTiming(durationMs: number, ok: boolean) {
	if (!state.running) {
		return;
	}
	state.documentGetCalls += 1;
	if (!ok) {
		state.documentGetErrors += 1;
	}
	state.documentGetTotalDurationMs += durationMs;
}

export function recordDocumentGetInFlightDelta(delta: 1 | -1) {
	if (!state.running) {
		return;
	}
	state.documentGetInFlight = Math.max(0, state.documentGetInFlight + delta);
}

export function recordBackendLogPendingDelta(delta: 1 | -1) {
	if (!state.running) {
		return;
	}
	state.pendingBackendLogs = Math.max(0, state.pendingBackendLogs + delta);
}

export function recordCommandInFlightDelta(
	command: "syncNow" | "gitPull" | "gitStatus",
	delta: 1 | -1,
) {
	if (!state.running) {
		return;
	}
	state.inFlightCommands[command] = Math.max(0, state.inFlightCommands[command] + delta);
	if (delta > 0) {
		state.lastGitCommandAt = Date.now();
	}
}

export function getAppMonitorSnapshot(): AppMonitorSnapshot {
	const lastSample = state.samples[state.samples.length - 1] ?? null;
	const documentGetAvgMs =
		state.documentGetCalls > 0
			? Math.round((state.documentGetTotalDurationMs / state.documentGetCalls) * 100) / 100
			: 0;
	return {
		startedAt: state.startedAt,
		lastSampleAt: state.lastSampleAt,
		uptimeMs: state.startedAt ? Date.now() - state.startedAt : 0,
		documentGetCalls: state.documentGetCalls,
		documentGetErrors: state.documentGetErrors,
		documentGetInFlight: state.documentGetInFlight,
		documentGetAvgMs,
		pendingBackendLogs: state.pendingBackendLogs,
		inFlightCommands: { ...state.inFlightCommands },
		lastGitCommandAt: state.lastGitCommandAt,
		lastSample,
		samples: [...state.samples],
	};
}

setBackendLogPendingTracker(recordBackendLogPendingDelta);
