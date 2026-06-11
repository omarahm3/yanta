import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateCheck } from "../useUpdateCheck";

const mockCheckForUpdate = vi.fn();
const mockBackendLoggerWarn = vi.fn();

vi.mock("../../../../bindings/yanta/internal/system/service", () => ({
	CheckForUpdate: () => mockCheckForUpdate(),
}));

vi.mock("../../utils/backendLogger", () => ({
	BackendLogger: {
		warn: (...args: unknown[]) => mockBackendLoggerWarn(...args),
	},
}));

describe("useUpdateCheck", () => {
	beforeEach(() => {
		localStorage.clear();
		mockCheckForUpdate.mockReset();
		mockBackendLoggerWarn.mockReset();
	});

	it("runs an automatic check and shows the prompt for a newer version", async () => {
		mockCheckForUpdate.mockResolvedValue({
			available: true,
			currentVersion: "1.2.0",
			latestVersion: "1.3.0",
			releaseUrl: "https://github.com/omarahm3/yanta/releases/tag/v1.3.0",
			releaseNotes: "New stuff",
			publishedAt: "2026-06-01T00:00:00Z",
			checked: true,
		});

		const { result } = renderHook(() => useUpdateCheck({ autoCheck: true }));

		await waitFor(() => expect(result.current.isChecking).toBe(false));

		expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
		expect(result.current.updateInfo?.latestVersion).toBe("1.3.0");
		expect(result.current.showPrompt).toBe(true);
	});

	it("persists dismissal for the current version", async () => {
		mockCheckForUpdate.mockResolvedValue({
			available: true,
			currentVersion: "1.2.0",
			latestVersion: "1.3.0",
			releaseUrl: "https://github.com/omarahm3/yanta/releases/tag/v1.3.0",
			releaseNotes: "",
			publishedAt: "",
			checked: true,
		});

		const { result } = renderHook(() => useUpdateCheck({ autoCheck: true }));

		await waitFor(() => expect(result.current.showPrompt).toBe(true));

		act(() => {
			result.current.dismiss();
		});

		expect(localStorage.getItem("yanta:update:dismissedVersion")).toBe("1.3.0");
		expect(result.current.showPrompt).toBe(false);
	});

	it("does not hide a newer version after dismissing an older one", async () => {
		localStorage.setItem("yanta:update:dismissedVersion", "1.3.0");
		mockCheckForUpdate.mockResolvedValue({
			available: true,
			currentVersion: "1.3.0",
			latestVersion: "1.4.0",
			releaseUrl: "https://github.com/omarahm3/yanta/releases/tag/v1.4.0",
			releaseNotes: "",
			publishedAt: "",
			checked: true,
		});

		const { result } = renderHook(() => useUpdateCheck({ autoCheck: true }));

		await waitFor(() => expect(result.current.isChecking).toBe(false));

		expect(result.current.showPrompt).toBe(true);
	});

	it("treats backend failures as non-fatal best-effort checks", async () => {
		mockCheckForUpdate.mockRejectedValue(new Error("offline"));

		const { result } = renderHook(() => useUpdateCheck());

		let checked = null;
		await act(async () => {
			checked = await result.current.check();
		});

		expect(checked).toBeNull();
		expect(result.current.checkFailed).toBe(true);
		expect(result.current.showPrompt).toBe(false);
		expect(mockBackendLoggerWarn).toHaveBeenCalled();
	});
});
