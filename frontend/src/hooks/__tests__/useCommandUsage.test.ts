import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useCommandUsage } from "../useCommandUsage";

describe("useCommandUsage", () => {
	const STORAGE_KEY = "yanta_command_usage";

	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("initializes with empty state when localStorage is empty", () => {
			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getAllCommandUsage()).toEqual({});
		});

		it("loads existing data from localStorage", () => {
			const existingData = {
				"nav-dashboard": { lastUsed: 1000, useCount: 5 },
				"new-document": { lastUsed: 2000, useCount: 3 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getAllCommandUsage()).toEqual(existingData);
		});

		it("handles invalid JSON in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, "invalid-json");

			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getAllCommandUsage()).toEqual({});
		});

		it("handles malformed data structure in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));

			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getAllCommandUsage()).toEqual({});
		});

		it("filters out invalid entries from localStorage", () => {
			const mixedData = {
				"valid-command": { lastUsed: 1000, useCount: 5 },
				"invalid-command": { lastUsed: "not-a-number", useCount: 3 },
				"another-invalid": { foo: "bar" },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(mixedData));

			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getAllCommandUsage()).toEqual({
				"valid-command": { lastUsed: 1000, useCount: 5 },
			});
		});
	});

	describe("recordCommandUsage", () => {
		it("records new command usage", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useCommandUsage());

			act(() => {
				result.current.recordCommandUsage("nav-dashboard");
			});

			const usage = result.current.getCommandUsage("nav-dashboard");
			expect(usage).toEqual({ lastUsed: 5000, useCount: 1 });
		});

		it("increments useCount for existing command", () => {
			const existingData = {
				"nav-dashboard": { lastUsed: 1000, useCount: 5 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
			vi.setSystemTime(new Date(5000));

			const { result } = renderHook(() => useCommandUsage());

			act(() => {
				result.current.recordCommandUsage("nav-dashboard");
			});

			const usage = result.current.getCommandUsage("nav-dashboard");
			expect(usage).toEqual({ lastUsed: 5000, useCount: 6 });
		});

		it("updates lastUsed timestamp", () => {
			vi.setSystemTime(new Date(1000));
			const { result } = renderHook(() => useCommandUsage());

			act(() => {
				result.current.recordCommandUsage("nav-dashboard");
			});

			expect(result.current.getCommandUsage("nav-dashboard")?.lastUsed).toBe(1000);

			vi.setSystemTime(new Date(2000));

			act(() => {
				result.current.recordCommandUsage("nav-dashboard");
			});

			expect(result.current.getCommandUsage("nav-dashboard")?.lastUsed).toBe(2000);
		});

		it("persists to localStorage", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useCommandUsage());

			act(() => {
				result.current.recordCommandUsage("nav-dashboard");
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored["nav-dashboard"]).toEqual({ lastUsed: 5000, useCount: 1 });
		});
	});

	describe("getCommandUsage", () => {
		it("returns undefined for unknown command", () => {
			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getCommandUsage("unknown-command")).toBeUndefined();
		});

		it("returns usage data for known command", () => {
			const existingData = {
				"nav-dashboard": { lastUsed: 1000, useCount: 5 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getCommandUsage("nav-dashboard")).toEqual({
				lastUsed: 1000,
				useCount: 5,
			});
		});
	});

	describe("getAllCommandUsage", () => {
		it("returns all usage data", () => {
			const existingData = {
				"nav-dashboard": { lastUsed: 1000, useCount: 5 },
				"new-document": { lastUsed: 2000, useCount: 3 },
				"nav-settings": { lastUsed: 500, useCount: 1 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useCommandUsage());

			expect(result.current.getAllCommandUsage()).toEqual(existingData);
		});
	});

	describe("cleanup logic", () => {
		it("prunes entries when exceeding 100 on record", () => {
			// Create 100 existing entries
			const existingData: Record<string, { lastUsed: number; useCount: number }> = {};
			for (let i = 0; i < 100; i++) {
				existingData[`command-${i}`] = { lastUsed: i * 1000, useCount: 1 };
			}
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			vi.setSystemTime(new Date(200000));
			const { result } = renderHook(() => useCommandUsage());

			// Add one more entry to trigger pruning
			act(() => {
				result.current.recordCommandUsage("new-command");
			});

			const allUsage = result.current.getAllCommandUsage();
			const keys = Object.keys(allUsage);

			// Should have exactly 100 entries
			expect(keys.length).toBe(100);

			// The oldest entry (command-0 with lastUsed: 0) should be removed
			expect(allUsage["command-0"]).toBeUndefined();

			// The new command should be present
			expect(allUsage["new-command"]).toBeDefined();
		});

		it("prunes entries on initial load when exceeding 100", () => {
			// Create 105 entries
			const existingData: Record<string, { lastUsed: number; useCount: number }> = {};
			for (let i = 0; i < 105; i++) {
				existingData[`command-${i}`] = { lastUsed: i * 1000, useCount: 1 };
			}
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useCommandUsage());

			const allUsage = result.current.getAllCommandUsage();
			const keys = Object.keys(allUsage);

			// Should have exactly 100 entries after pruning
			expect(keys.length).toBe(100);

			// The 5 oldest entries should be removed (command-0 through command-4)
			for (let i = 0; i < 5; i++) {
				expect(allUsage[`command-${i}`]).toBeUndefined();
			}

			// The remaining entries should be present
			for (let i = 5; i < 105; i++) {
				expect(allUsage[`command-${i}`]).toBeDefined();
			}
		});

		it("does not prune when at exactly 100 entries", () => {
			const existingData: Record<string, { lastUsed: number; useCount: number }> = {};
			for (let i = 0; i < 100; i++) {
				existingData[`command-${i}`] = { lastUsed: i * 1000, useCount: 1 };
			}
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useCommandUsage());

			const allUsage = result.current.getAllCommandUsage();
			expect(Object.keys(allUsage).length).toBe(100);

			// All original entries should be present
			for (let i = 0; i < 100; i++) {
				expect(allUsage[`command-${i}`]).toBeDefined();
			}
		});
	});

	describe("storage event handling", () => {
		it("updates state when storage changes from another tab", () => {
			const { result } = renderHook(() => useCommandUsage());

			const newData = {
				"external-command": { lastUsed: 9999, useCount: 42 },
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

			expect(result.current.getCommandUsage("external-command")).toEqual({
				lastUsed: 9999,
				useCount: 42,
			});
		});

		it("ignores storage events for other keys", () => {
			const existingData = {
				"nav-dashboard": { lastUsed: 1000, useCount: 5 },
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useCommandUsage());

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
			expect(result.current.getCommandUsage("nav-dashboard")).toEqual({
				lastUsed: 1000,
				useCount: 5,
			});
		});
	});
});
