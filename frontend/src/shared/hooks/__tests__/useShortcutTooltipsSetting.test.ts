import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShortcutTooltipsSetting } from "../useShortcutTooltipsSetting";

const mockGetShowShortcutTooltips = vi.fn();
const mockSetShowShortcutTooltips = vi.fn();

vi.mock("../../../../bindings/yanta/internal/system/service.js", () => ({
	GetShowShortcutTooltips: () => mockGetShowShortcutTooltips(),
	SetShowShortcutTooltips: (show: boolean) => mockSetShowShortcutTooltips(show),
	LogFromFrontend: vi.fn(),
}));

vi.mock("../useFeatureFlag", () => ({
	useFeatureFlag: () => ({ enabled: true, isLoading: false }),
}));

describe("useShortcutTooltipsSetting", () => {
	beforeEach(() => {
		mockGetShowShortcutTooltips.mockReset();
		mockSetShowShortcutTooltips.mockReset();
	});

	it("loads initial shortcut tooltips visibility from backend", async () => {
		mockGetShowShortcutTooltips.mockResolvedValue(true);

		const { result } = renderHook(() => useShortcutTooltipsSetting());

		// Initially loading
		expect(result.current.isLoading).toBe(true);
		expect(result.current.showShortcutTooltips).toBe(true); // Default is true

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.showShortcutTooltips).toBe(true);
		expect(mockGetShowShortcutTooltips).toHaveBeenCalledTimes(1);
	});

	it("shows tooltips as disabled when backend returns false", async () => {
		mockGetShowShortcutTooltips.mockResolvedValue(false);

		const { result } = renderHook(() => useShortcutTooltipsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.showShortcutTooltips).toBe(false);
	});

	it("defaults to true when backend errors", async () => {
		mockGetShowShortcutTooltips.mockRejectedValue(new Error("Backend error"));

		const { result } = renderHook(() => useShortcutTooltipsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Should default to true on error (tooltips shown)
		expect(result.current.showShortcutTooltips).toBe(true);
	});

	it("setShowShortcutTooltips updates state optimistically", async () => {
		mockGetShowShortcutTooltips.mockResolvedValue(true);
		mockSetShowShortcutTooltips.mockResolvedValue(undefined);

		const { result } = renderHook(() => useShortcutTooltipsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			await result.current.setShowShortcutTooltips(false);
		});

		expect(result.current.showShortcutTooltips).toBe(false);
		expect(mockSetShowShortcutTooltips).toHaveBeenCalledWith(false);
	});

	it("setShowShortcutTooltips reverts state on error", async () => {
		mockGetShowShortcutTooltips.mockResolvedValue(true);
		mockSetShowShortcutTooltips.mockRejectedValue(new Error("Failed to save"));
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useShortcutTooltipsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			try {
				await result.current.setShowShortcutTooltips(false);
			} catch {
				// Expected to throw
			}
		});

		// Should revert to original value
		expect(result.current.showShortcutTooltips).toBe(true);

		consoleSpy.mockRestore();
	});

	it("toggleShortcutTooltips toggles the visibility state", async () => {
		mockGetShowShortcutTooltips.mockResolvedValue(true);
		mockSetShowShortcutTooltips.mockResolvedValue(undefined);

		const { result } = renderHook(() => useShortcutTooltipsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Toggle from true to false
		await act(async () => {
			await result.current.toggleShortcutTooltips();
		});

		expect(result.current.showShortcutTooltips).toBe(false);
		expect(mockSetShowShortcutTooltips).toHaveBeenCalledWith(false);

		// Toggle from false to true
		await act(async () => {
			await result.current.toggleShortcutTooltips();
		});

		expect(result.current.showShortcutTooltips).toBe(true);
		expect(mockSetShowShortcutTooltips).toHaveBeenCalledWith(true);
	});
});
