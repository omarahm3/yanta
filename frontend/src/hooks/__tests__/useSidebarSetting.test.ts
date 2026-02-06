import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetLiveRegion } from "../../utils/accessibility";
import { useSidebarSetting } from "../useSidebarSetting";

const mockGetSidebarVisible = vi.fn();
const mockSetSidebarVisible = vi.fn();
const mockBackendLoggerError = vi.fn();

vi.mock("../../utils/backendLogger", () => ({
	BackendLogger: { error: (...args: unknown[]) => mockBackendLoggerError(...args) },
}));

vi.mock("../../../bindings/yanta/internal/system/service", () => ({
	GetSidebarVisible: () => mockGetSidebarVisible(),
	SetSidebarVisible: (visible: boolean) => mockSetSidebarVisible(visible),
}));

describe("useSidebarSetting", () => {
	beforeEach(() => {
		mockGetSidebarVisible.mockReset();
		mockSetSidebarVisible.mockReset();
		_resetLiveRegion();
	});

	afterEach(() => {
		_resetLiveRegion();
	});

	it("loads initial sidebar visibility from backend", async () => {
		mockGetSidebarVisible.mockResolvedValue(true);

		const { result } = renderHook(() => useSidebarSetting());

		// Initially loading
		expect(result.current.isLoading).toBe(true);
		expect(result.current.sidebarVisible).toBe(false);

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.sidebarVisible).toBe(true);
		expect(mockGetSidebarVisible).toHaveBeenCalledTimes(1);
	});

	it("defaults to hidden when backend returns false", async () => {
		mockGetSidebarVisible.mockResolvedValue(false);

		const { result } = renderHook(() => useSidebarSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.sidebarVisible).toBe(false);
	});

	it("handles backend error gracefully on load", async () => {
		mockBackendLoggerError.mockClear();
		mockGetSidebarVisible.mockRejectedValue(new Error("Backend error"));

		const { result } = renderHook(() => useSidebarSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Should default to false on error
		expect(result.current.sidebarVisible).toBe(false);
		expect(mockBackendLoggerError).toHaveBeenCalled();
	});

	it("setSidebarVisible updates state optimistically", async () => {
		mockGetSidebarVisible.mockResolvedValue(false);
		mockSetSidebarVisible.mockResolvedValue(undefined);

		const { result } = renderHook(() => useSidebarSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			await result.current.setSidebarVisible(true);
		});

		expect(result.current.sidebarVisible).toBe(true);
		expect(mockSetSidebarVisible).toHaveBeenCalledWith(true);
	});

	it("setSidebarVisible reverts state on error", async () => {
		mockGetSidebarVisible.mockResolvedValue(false);
		mockSetSidebarVisible.mockRejectedValue(new Error("Failed to save"));

		const { result } = renderHook(() => useSidebarSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			try {
				await result.current.setSidebarVisible(true);
			} catch {
				// Expected to throw
			}
		});

		// Should revert to original value
		expect(result.current.sidebarVisible).toBe(false);
	});

	it("toggleSidebar toggles the visibility state", async () => {
		mockGetSidebarVisible.mockResolvedValue(false);
		mockSetSidebarVisible.mockResolvedValue(undefined);

		const { result } = renderHook(() => useSidebarSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Toggle from false to true
		await act(async () => {
			await result.current.toggleSidebar();
		});

		expect(result.current.sidebarVisible).toBe(true);
		expect(mockSetSidebarVisible).toHaveBeenCalledWith(true);

		// Toggle from true to false
		await act(async () => {
			await result.current.toggleSidebar();
		});

		expect(result.current.sidebarVisible).toBe(false);
		expect(mockSetSidebarVisible).toHaveBeenCalledWith(false);
	});

	it("toggleSidebar announces state changes for screen readers", async () => {
		mockGetSidebarVisible.mockResolvedValue(false);
		mockSetSidebarVisible.mockResolvedValue(undefined);

		const { result } = renderHook(() => useSidebarSetting());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Toggle from false to true - should announce "Sidebar shown."
		await act(async () => {
			await result.current.toggleSidebar();
		});

		// Wait for requestAnimationFrame to complete
		await new Promise((resolve) => requestAnimationFrame(resolve));

		let liveRegion = document.querySelector('[role="status"][aria-live]');
		expect(liveRegion?.textContent).toBe("Sidebar shown.");

		// Toggle from true to false - should announce "Sidebar hidden. Press Ctrl+B to show."
		await act(async () => {
			await result.current.toggleSidebar();
		});

		// Wait for requestAnimationFrame to complete
		await new Promise((resolve) => requestAnimationFrame(resolve));

		liveRegion = document.querySelector('[role="status"][aria-live]');
		expect(liveRegion?.textContent).toBe("Sidebar hidden. Press Ctrl+B to show.");
	});
});
