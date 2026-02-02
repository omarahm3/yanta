import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTooltipUsage } from "../useTooltipUsage";

describe("useTooltipUsage", () => {
	const STORAGE_KEY = "yanta_tooltip_usage";
	const FADE_THRESHOLD = 5;
	const DORMANCY_DAYS = 30;
	const DORMANCY_MS = DORMANCY_DAYS * 24 * 60 * 60 * 1000;

	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("initializes with empty state when localStorage is empty", () => {
			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getAllTooltipUsage()).toEqual({});
		});

		it("loads existing data from localStorage", () => {
			const existingData = {
				"new-document-btn": { seenCount: 3, lastSeen: 1000 },
				"save-btn": { seenCount: 1, lastSeen: 2000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getAllTooltipUsage()).toEqual(existingData);
		});

		it("handles invalid JSON in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, "invalid-json");

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getAllTooltipUsage()).toEqual({});
		});

		it("handles malformed data structure in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getAllTooltipUsage()).toEqual({});
		});

		it("filters out invalid entries from localStorage", () => {
			const mixedData = {
				"valid-tooltip": { seenCount: 3, lastSeen: 1000 },
				"invalid-tooltip": { seenCount: "not-a-number", lastSeen: 3 },
				"another-invalid": { foo: "bar" },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(mixedData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getAllTooltipUsage()).toEqual({
				"valid-tooltip": { seenCount: 3, lastSeen: 1000 },
			});
		});
	});

	describe("shouldShowTooltip", () => {
		it("returns true for tooltip that has never been seen", () => {
			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.shouldShowTooltip("new-tooltip")).toBe(true);
		});

		it("returns true when seenCount is below fade threshold", () => {
			const existingData = {
				"some-tooltip": { seenCount: FADE_THRESHOLD - 1, lastSeen: Date.now() },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.shouldShowTooltip("some-tooltip")).toBe(true);
		});

		it("returns false when seenCount equals fade threshold and within dormancy period", () => {
			vi.setSystemTime(new Date(100000));
			const existingData = {
				"some-tooltip": { seenCount: FADE_THRESHOLD, lastSeen: 100000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.shouldShowTooltip("some-tooltip")).toBe(false);
		});

		it("returns false when seenCount exceeds fade threshold and within dormancy period", () => {
			vi.setSystemTime(new Date(100000));
			const existingData = {
				"some-tooltip": { seenCount: FADE_THRESHOLD + 5, lastSeen: 100000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.shouldShowTooltip("some-tooltip")).toBe(false);
		});

		it("returns true when lastSeen exceeds dormancy period (30+ days)", () => {
			const now = 100000 + DORMANCY_MS + 1;
			vi.setSystemTime(new Date(now));
			const existingData = {
				"some-tooltip": { seenCount: FADE_THRESHOLD + 10, lastSeen: 100000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.shouldShowTooltip("some-tooltip")).toBe(true);
		});

		it("returns false when lastSeen is exactly at dormancy period boundary", () => {
			const now = 100000 + DORMANCY_MS;
			vi.setSystemTime(new Date(now));
			const existingData = {
				"some-tooltip": { seenCount: FADE_THRESHOLD, lastSeen: 100000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.shouldShowTooltip("some-tooltip")).toBe(false);
		});
	});

	describe("recordTooltipView", () => {
		it("records new tooltip view", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useTooltipUsage());

			act(() => {
				result.current.recordTooltipView("new-document-btn");
			});

			const usage = result.current.getTooltipUsage("new-document-btn");
			expect(usage).toEqual({ seenCount: 1, lastSeen: 5000 });
		});

		it("increments seenCount for existing tooltip", () => {
			const existingData = {
				"new-document-btn": { seenCount: 3, lastSeen: 1000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
			vi.setSystemTime(new Date(5000));

			const { result } = renderHook(() => useTooltipUsage());

			act(() => {
				result.current.recordTooltipView("new-document-btn");
			});

			const usage = result.current.getTooltipUsage("new-document-btn");
			expect(usage).toEqual({ seenCount: 4, lastSeen: 5000 });
		});

		it("updates lastSeen timestamp", () => {
			vi.setSystemTime(new Date(1000));
			const { result } = renderHook(() => useTooltipUsage());

			act(() => {
				result.current.recordTooltipView("some-tooltip");
			});

			expect(result.current.getTooltipUsage("some-tooltip")?.lastSeen).toBe(1000);

			vi.setSystemTime(new Date(2000));

			act(() => {
				result.current.recordTooltipView("some-tooltip");
			});

			expect(result.current.getTooltipUsage("some-tooltip")?.lastSeen).toBe(2000);
		});

		it("persists to localStorage", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useTooltipUsage());

			act(() => {
				result.current.recordTooltipView("new-document-btn");
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored["new-document-btn"]).toEqual({ seenCount: 1, lastSeen: 5000 });
		});
	});

	describe("getTooltipUsage", () => {
		it("returns undefined for unknown tooltip", () => {
			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getTooltipUsage("unknown-tooltip")).toBeUndefined();
		});

		it("returns usage data for known tooltip", () => {
			const existingData = {
				"new-document-btn": { seenCount: 3, lastSeen: 1000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getTooltipUsage("new-document-btn")).toEqual({
				seenCount: 3,
				lastSeen: 1000,
			});
		});
	});

	describe("getAllTooltipUsage", () => {
		it("returns all usage data", () => {
			const existingData = {
				"new-document-btn": { seenCount: 3, lastSeen: 1000 },
				"save-btn": { seenCount: 1, lastSeen: 2000 },
				"sidebar-journal": { seenCount: 5, lastSeen: 500 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.getAllTooltipUsage()).toEqual(existingData);
		});
	});

	describe("fade behavior integration", () => {
		it("tooltip fades after being shown 5 times", () => {
			vi.setSystemTime(new Date(1000));
			const { result } = renderHook(() => useTooltipUsage());

			// Tooltip should show for the first 5 views
			for (let i = 0; i < FADE_THRESHOLD; i++) {
				expect(result.current.shouldShowTooltip("test-tooltip")).toBe(true);
				act(() => {
					result.current.recordTooltipView("test-tooltip");
				});
			}

			// After 5 views, tooltip should not show
			expect(result.current.shouldShowTooltip("test-tooltip")).toBe(false);
		});

		it("tooltip reappears after 30 days of dormancy", () => {
			vi.setSystemTime(new Date(1000));
			const { result } = renderHook(() => useTooltipUsage());

			// Record enough views to fade the tooltip
			for (let i = 0; i < FADE_THRESHOLD; i++) {
				act(() => {
					result.current.recordTooltipView("test-tooltip");
				});
			}

			// Tooltip should not show
			expect(result.current.shouldShowTooltip("test-tooltip")).toBe(false);

			// Advance time by 31 days
			vi.setSystemTime(new Date(1000 + DORMANCY_MS + 1));

			// Need to re-render to get updated time in shouldShowTooltip
			const { result: result2 } = renderHook(() => useTooltipUsage());

			// Tooltip should show again after dormancy period
			expect(result2.current.shouldShowTooltip("test-tooltip")).toBe(true);
		});
	});

	describe("globalDisabled option", () => {
		it("shouldShowTooltip returns false when globalDisabled is true", () => {
			const { result } = renderHook(() => useTooltipUsage({ globalDisabled: true }));

			// Even for a new tooltip that hasn't been seen, should return false
			expect(result.current.shouldShowTooltip("new-tooltip")).toBe(false);
		});

		it("shouldShowTooltip works normally when globalDisabled is false", () => {
			const { result } = renderHook(() => useTooltipUsage({ globalDisabled: false }));

			expect(result.current.shouldShowTooltip("new-tooltip")).toBe(true);
		});

		it("shouldShowTooltip works normally when no options provided", () => {
			const { result } = renderHook(() => useTooltipUsage());

			expect(result.current.shouldShowTooltip("new-tooltip")).toBe(true);
		});

		it("recordTooltipView still works when globalDisabled is true", () => {
			vi.setSystemTime(new Date(1000));
			const { result } = renderHook(() => useTooltipUsage({ globalDisabled: true }));

			act(() => {
				result.current.recordTooltipView("test-tooltip");
			});

			// The view should still be recorded
			expect(result.current.getTooltipUsage("test-tooltip")).toEqual({
				seenCount: 1,
				lastSeen: 1000,
			});
		});
	});

	describe("storage event handling", () => {
		it("updates state when storage changes from another tab", () => {
			const { result } = renderHook(() => useTooltipUsage());

			const newData = {
				"external-tooltip": { seenCount: 42, lastSeen: 9999 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));

			// Simulate storage event from another tab
			act(() => {
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: STORAGE_KEY,
						newValue: JSON.stringify(newData),
					}),
				);
			});

			expect(result.current.getTooltipUsage("external-tooltip")).toEqual({
				seenCount: 42,
				lastSeen: 9999,
			});
		});

		it("ignores storage events for other keys", () => {
			const existingData = {
				"new-document-btn": { seenCount: 3, lastSeen: 1000 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useTooltipUsage());

			// Simulate storage event for a different key
			act(() => {
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: "other_key",
						newValue: "something",
					}),
				);
			});

			// State should remain unchanged
			expect(result.current.getTooltipUsage("new-document-btn")).toEqual({
				seenCount: 3,
				lastSeen: 1000,
			});
		});
	});
});
