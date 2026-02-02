import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useFooterHintsSetting } from "../useFooterHintsSetting";

const mockGetShowFooterHints = vi.fn();
const mockSetShowFooterHints = vi.fn();

vi.mock("../../../bindings/yanta/internal/system/service.js", () => ({
	GetShowFooterHints: () => mockGetShowFooterHints(),
	SetShowFooterHints: (show: boolean) => mockSetShowFooterHints(show),
}));

describe("useFooterHintsSetting", () => {
	beforeEach(() => {
		mockGetShowFooterHints.mockReset();
		mockSetShowFooterHints.mockReset();
	});

	it("loads initial footer hints visibility from backend", async () => {
		mockGetShowFooterHints.mockResolvedValue(true);

		const { result } = renderHook(() => useFooterHintsSetting());

		// Initially loading
		expect(result.current.isLoading).toBe(true);
		expect(result.current.showFooterHints).toBe(true); // Default is true

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.showFooterHints).toBe(true);
		expect(mockGetShowFooterHints).toHaveBeenCalledTimes(1);
	});

	it("shows hints as hidden when backend returns false", async () => {
		mockGetShowFooterHints.mockResolvedValue(false);

		const { result } = renderHook(() => useFooterHintsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.showFooterHints).toBe(false);
	});

	it("defaults to true when backend errors", async () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		mockGetShowFooterHints.mockRejectedValue(new Error("Backend error"));

		const { result } = renderHook(() => useFooterHintsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Should default to true on error (hints shown)
		expect(result.current.showFooterHints).toBe(true);
		expect(consoleSpy).toHaveBeenCalled();

		consoleSpy.mockRestore();
	});

	it("setShowFooterHints updates state optimistically", async () => {
		mockGetShowFooterHints.mockResolvedValue(true);
		mockSetShowFooterHints.mockResolvedValue(undefined);

		const { result } = renderHook(() => useFooterHintsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			await result.current.setShowFooterHints(false);
		});

		expect(result.current.showFooterHints).toBe(false);
		expect(mockSetShowFooterHints).toHaveBeenCalledWith(false);
	});

	it("setShowFooterHints reverts state on error", async () => {
		mockGetShowFooterHints.mockResolvedValue(true);
		mockSetShowFooterHints.mockRejectedValue(new Error("Failed to save"));
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const { result } = renderHook(() => useFooterHintsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			try {
				await result.current.setShowFooterHints(false);
			} catch {
				// Expected to throw
			}
		});

		// Should revert to original value
		expect(result.current.showFooterHints).toBe(true);

		consoleSpy.mockRestore();
	});

	it("toggleFooterHints toggles the visibility state", async () => {
		mockGetShowFooterHints.mockResolvedValue(true);
		mockSetShowFooterHints.mockResolvedValue(undefined);

		const { result } = renderHook(() => useFooterHintsSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Toggle from true to false
		await act(async () => {
			await result.current.toggleFooterHints();
		});

		expect(result.current.showFooterHints).toBe(false);
		expect(mockSetShowFooterHints).toHaveBeenCalledWith(false);

		// Toggle from false to true
		await act(async () => {
			await result.current.toggleFooterHints();
		});

		expect(result.current.showFooterHints).toBe(true);
		expect(mockSetShowFooterHints).toHaveBeenCalledWith(true);
	});
});
