import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatus } from "../../../../bindings/yanta/internal/git/models";

vi.mock("../../../../bindings/yanta/internal/system/service", () => ({
	SyncNow: vi.fn(),
}));

vi.mock("../../../monitoring/appMonitor", () => ({
	recordCommandInFlightDelta: vi.fn(),
}));

import { SyncNow } from "../../../../bindings/yanta/internal/system/service";
import { useSyncStore } from "../sync.store";

const mockSyncNow = vi.mocked(SyncNow);

describe("sync store", () => {
	beforeEach(() => {
		useSyncStore.getState().reset();
		mockSyncNow.mockReset();
		localStorage.clear();
	});

	it("starts with inProgress false and no lastError", () => {
		const state = useSyncStore.getState();
		expect(state.inProgress).toBe(false);
		expect(state.lastError).toBeNull();
	});

	it("syncNow sets inProgress during execution and clears it after", async () => {
		mockSyncNow.mockResolvedValue({
			status: SyncStatus.SyncStatusSynced,
			filesChanged: 0,
			message: "ok",
			pulled: false,
			pulledFiles: 0,
		} as never);

		const promise = useSyncStore.getState().syncNow();
		expect(useSyncStore.getState().inProgress).toBe(true);

		await promise;
		expect(useSyncStore.getState().inProgress).toBe(false);
	});

	it("syncNow updates lastSynced and status on success", async () => {
		mockSyncNow.mockResolvedValue({
			status: SyncStatus.SyncStatusCommitted,
			filesChanged: 2,
			message: "committed 2 files",
			pulled: false,
			pulledFiles: 0,
		} as never);

		await useSyncStore.getState().syncNow();

		const state = useSyncStore.getState();
		expect(state.status).toBe(SyncStatus.SyncStatusCommitted);
		expect(state.lastSynced?.status).toBe(SyncStatus.SyncStatusCommitted);
		expect(state.lastError).toBeNull();
	});

	it("syncNow sets lastError on failure", async () => {
		mockSyncNow.mockRejectedValue(new Error("network down"));

		await expect(useSyncStore.getState().syncNow()).rejects.toThrow("network down");

		const state = useSyncStore.getState();
		expect(state.status).toBe("error");
		expect(state.lastSynced?.status).toBe("error");
		expect(state.lastError).toBe("Error: network down");
	});

	it("syncNow is a no-op when already in progress", async () => {
		let resolveFirst: (v: unknown) => void;
		const firstCall = new Promise((r) => {
			resolveFirst = r;
		});
		mockSyncNow.mockReturnValueOnce(firstCall as never);

		const first = useSyncStore.getState().syncNow();
		expect(useSyncStore.getState().inProgress).toBe(true);

		await useSyncStore.getState().syncNow();
		expect(mockSyncNow).toHaveBeenCalledTimes(1);

		resolveFirst!({
			status: SyncStatus.SyncStatusSynced,
			filesChanged: 0,
			message: "ok",
			pulled: false,
			pulledFiles: 0,
		});
		await first;
	});

	it("syncNow handles null result as SyncStatusSynced", async () => {
		mockSyncNow.mockResolvedValue(null as never);

		await useSyncStore.getState().syncNow();

		const state = useSyncStore.getState();
		expect(state.status).toBe(SyncStatus.SyncStatusSynced);
		expect(state.lastSynced?.status).toBe(SyncStatus.SyncStatusSynced);
	});

	it("persists lastSynced to localStorage", async () => {
		mockSyncNow.mockResolvedValue({
			status: SyncStatus.SyncStatusSynced,
			filesChanged: 0,
			message: "ok",
			pulled: false,
			pulledFiles: 0,
		} as never);

		await useSyncStore.getState().syncNow();

		const raw = localStorage.getItem("yanta.gitSync.lastSync");
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw!);
		expect(parsed.status).toBe(SyncStatus.SyncStatusSynced);
	});

	it("reads persisted lastSynced on creation", () => {
		const persisted = { at: Date.now(), status: SyncStatus.SyncStatusSynced };
		localStorage.setItem("yanta.gitSync.lastSync", JSON.stringify(persisted));

		useSyncStore.getState().reset();
		const state = useSyncStore.getState();
		expect(state.lastSynced?.status).toBe(SyncStatus.SyncStatusSynced);
	});

	it("setLastError updates lastError", () => {
		useSyncStore.getState().setLastError("background sync failed");
		expect(useSyncStore.getState().lastError).toBe("background sync failed");
	});
});
