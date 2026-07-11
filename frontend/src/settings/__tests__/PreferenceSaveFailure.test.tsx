import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../shared/stores/preferences.store";

vi.mock("../../shared/services/ConfigService", () => ({
	getPreferencesOverrides: vi.fn().mockResolvedValue({}),
	setPreferencesOverrides: vi.fn().mockRejectedValue(new Error("Save failed")),
}));

vi.mock("../../shared/utils/backendLogger", () => ({
	BackendLogger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}));

describe("Preferences store save failure (MRG-365)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usePreferencesStore.setState({ overrides: null, isLoading: false });
	});

	it("rethrows save errors so callers can handle them", async () => {
		const { result } = renderHook(() => usePreferencesStore());

		await act(async () => {
			await expect(result.current.saveOverrides({ appearance: { theme: "dark" } })).rejects.toThrow(
				"Save failed",
			);
		});
	});

	it("does not update overrides state when save fails", async () => {
		const { result } = renderHook(() => usePreferencesStore());

		await act(async () => {
			try {
				await result.current.saveOverrides({ appearance: { theme: "dark" } });
			} catch {
				// Expected to throw
			}
		});

		expect(result.current.overrides).toBeNull();
	});
});
