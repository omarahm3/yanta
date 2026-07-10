import { create } from "zustand";
import { SyncStatus, type SyncResult } from "../../../bindings/yanta/internal/git/models";
import { SyncNow } from "../../../bindings/yanta/internal/system/service";
import { recordCommandInFlightDelta } from "../monitoring/appMonitor";

const LAST_SYNC_KEY = "yanta.gitSync.lastSync";

export type SyncOutcome = SyncStatus | "error";

interface SyncStoreState {
	inProgress: boolean;
	lastSynced: { at: number; status: SyncOutcome } | null;
	status: SyncOutcome | null;
	lastError: string | null;
	syncNow: () => Promise<SyncResult | null | undefined>;
	refreshStatus: () => void;
	setLastSync: (sync: { at: number; status: SyncOutcome } | null) => void;
	setLastError: (error: string | null) => void;
	setInProgress: (inProgress: boolean) => void;
	reset: () => void;
}

function readPersistedLastSync(): { at: number; status: SyncOutcome } | null {
	try {
		const raw = localStorage.getItem(LAST_SYNC_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function persistLastSync(sync: { at: number; status: SyncOutcome } | null) {
	try {
		if (sync) localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(sync));
	} catch {
		// non-fatal: last-sync display just won't persist
	}
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
	inProgress: false,
	lastSynced: readPersistedLastSync(),
	status: null,
	lastError: null,
	syncNow: async () => {
		if (get().inProgress) return undefined;
		set({ inProgress: true });
		recordCommandInFlightDelta("syncNow", 1);
		try {
			const result = await SyncNow();
			if (!result) {
				const lastSynced = { at: Date.now(), status: SyncStatus.SyncStatusSynced as SyncOutcome };
				set({ lastSynced, status: SyncStatus.SyncStatusSynced, lastError: null });
				persistLastSync(lastSynced);
				return null;
			}
			const lastSynced = { at: Date.now(), status: result.status as SyncOutcome };
			set({ lastSynced, status: result.status as SyncOutcome, lastError: null });
			persistLastSync(lastSynced);
			return result;
		} catch (err) {
			const lastSynced = { at: Date.now(), status: "error" as SyncOutcome };
			set({ lastSynced, status: "error", lastError: String(err) });
			persistLastSync(lastSynced);
			throw err;
		} finally {
			recordCommandInFlightDelta("syncNow", -1);
			set({ inProgress: false });
		}
	},
	refreshStatus: () => {
		set({ lastSynced: readPersistedLastSync() });
	},
	setLastSync: (sync) => {
		set({ lastSynced: sync });
		persistLastSync(sync);
	},
	setLastError: (error) => set({ lastError: error }),
	setInProgress: (inProgress) => set({ inProgress }),
	reset: () =>
		set({
			inProgress: false,
			lastSynced: readPersistedLastSync(),
			status: null,
			lastError: null,
		}),
}));
