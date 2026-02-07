import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserProgress } from "../useUserProgress";

describe("useUserProgress", () => {
	const STORAGE_KEY = "yanta_user_progress";

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initialization", () => {
		it("initializes with default values when localStorage is empty", () => {
			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData).toEqual({
				documentsCreated: 0,
				journalEntriesCreated: 0,
				projectsSwitched: 0,
				hintsShown: [],
			});
		});

		it("loads existing data from localStorage", () => {
			const existingData = {
				documentsCreated: 5,
				journalEntriesCreated: 10,
				projectsSwitched: 3,
				hintsShown: ["hint1", "hint2"],
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData).toEqual(existingData);
		});

		it("handles invalid JSON in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, "invalid-json");

			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData).toEqual({
				documentsCreated: 0,
				journalEntriesCreated: 0,
				projectsSwitched: 0,
				hintsShown: [],
			});
		});

		it("handles malformed data structure in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));

			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData).toEqual({
				documentsCreated: 0,
				journalEntriesCreated: 0,
				projectsSwitched: 0,
				hintsShown: [],
			});
		});

		it("handles partially missing fields with defaults", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentsCreated: 5 }));

			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData).toEqual({
				documentsCreated: 5,
				journalEntriesCreated: 0,
				projectsSwitched: 0,
				hintsShown: [],
			});
		});

		it("handles invalid field types with defaults", () => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					documentsCreated: "not-a-number",
					journalEntriesCreated: null,
					projectsSwitched: true,
					hintsShown: "not-an-array",
				}),
			);

			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData).toEqual({
				documentsCreated: 0,
				journalEntriesCreated: 0,
				projectsSwitched: 0,
				hintsShown: [],
			});
		});
	});

	describe("incrementDocumentsCreated", () => {
		it("increments documents created count", () => {
			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData.documentsCreated).toBe(0);

			act(() => {
				result.current.incrementDocumentsCreated();
			});

			expect(result.current.progressData.documentsCreated).toBe(1);
		});

		it("persists to localStorage", () => {
			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.incrementDocumentsCreated();
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored.documentsCreated).toBe(1);
		});

		it("increments correctly from existing value", () => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					documentsCreated: 5,
					journalEntriesCreated: 0,
					projectsSwitched: 0,
					hintsShown: [],
				}),
			);

			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.incrementDocumentsCreated();
			});

			expect(result.current.progressData.documentsCreated).toBe(6);
		});
	});

	describe("incrementJournalEntriesCreated", () => {
		it("increments journal entries created count", () => {
			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData.journalEntriesCreated).toBe(0);

			act(() => {
				result.current.incrementJournalEntriesCreated();
			});

			expect(result.current.progressData.journalEntriesCreated).toBe(1);
		});

		it("persists to localStorage", () => {
			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.incrementJournalEntriesCreated();
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored.journalEntriesCreated).toBe(1);
		});
	});

	describe("incrementProjectsSwitched", () => {
		it("increments projects switched count", () => {
			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData.projectsSwitched).toBe(0);

			act(() => {
				result.current.incrementProjectsSwitched();
			});

			expect(result.current.progressData.projectsSwitched).toBe(1);
		});

		it("persists to localStorage", () => {
			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.incrementProjectsSwitched();
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored.projectsSwitched).toBe(1);
		});
	});

	describe("markHintShown", () => {
		it("adds hint to hintsShown array", () => {
			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData.hintsShown).toEqual([]);

			act(() => {
				result.current.markHintShown("first-save");
			});

			expect(result.current.progressData.hintsShown).toEqual(["first-save"]);
		});

		it("does not duplicate hints", () => {
			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.markHintShown("first-save");
				result.current.markHintShown("first-save");
			});

			expect(result.current.progressData.hintsShown).toEqual(["first-save"]);
		});

		it("can track multiple different hints", () => {
			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.markHintShown("first-save");
				result.current.markHintShown("journal-nav");
				result.current.markHintShown("quick-switch");
			});

			expect(result.current.progressData.hintsShown).toEqual([
				"first-save",
				"journal-nav",
				"quick-switch",
			]);
		});

		it("persists to localStorage", () => {
			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.markHintShown("first-save");
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored.hintsShown).toEqual(["first-save"]);
		});
	});

	describe("hasHintBeenShown", () => {
		it("returns false for hint that has not been shown", () => {
			const { result } = renderHook(() => useUserProgress());

			expect(result.current.hasHintBeenShown("first-save")).toBe(false);
		});

		it("returns true for hint that has been shown", () => {
			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.markHintShown("first-save");
			});

			expect(result.current.hasHintBeenShown("first-save")).toBe(true);
		});

		it("returns correct value for loaded data", () => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					documentsCreated: 0,
					journalEntriesCreated: 0,
					projectsSwitched: 0,
					hintsShown: ["first-save", "journal-nav"],
				}),
			);

			const { result } = renderHook(() => useUserProgress());

			expect(result.current.hasHintBeenShown("first-save")).toBe(true);
			expect(result.current.hasHintBeenShown("journal-nav")).toBe(true);
			expect(result.current.hasHintBeenShown("quick-switch")).toBe(false);
		});
	});

	describe("resetProgress", () => {
		it("resets all progress data to defaults", () => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					documentsCreated: 10,
					journalEntriesCreated: 20,
					projectsSwitched: 5,
					hintsShown: ["hint1", "hint2"],
				}),
			);

			const { result } = renderHook(() => useUserProgress());

			expect(result.current.progressData.documentsCreated).toBe(10);

			act(() => {
				result.current.resetProgress();
			});

			expect(result.current.progressData).toEqual({
				documentsCreated: 0,
				journalEntriesCreated: 0,
				projectsSwitched: 0,
				hintsShown: [],
			});
		});

		it("removes data from localStorage", () => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					documentsCreated: 10,
					journalEntriesCreated: 20,
					projectsSwitched: 5,
					hintsShown: ["hint1"],
				}),
			);

			const { result } = renderHook(() => useUserProgress());

			act(() => {
				result.current.resetProgress();
			});

			expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		});
	});

	describe("storage event handling", () => {
		it("updates state when storage changes from another tab", () => {
			const { result } = renderHook(() => useUserProgress());

			const newData = {
				documentsCreated: 50,
				journalEntriesCreated: 100,
				projectsSwitched: 25,
				hintsShown: ["new-hint"],
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

			expect(result.current.progressData).toEqual(newData);
		});

		it("ignores storage events for other keys", () => {
			const existingData = {
				documentsCreated: 5,
				journalEntriesCreated: 10,
				projectsSwitched: 3,
				hintsShown: ["hint1"],
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useUserProgress());

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
			expect(result.current.progressData).toEqual(existingData);
		});
	});

	describe("full progress tracking flow", () => {
		it("tracks a complete user journey", () => {
			const { result } = renderHook(() => useUserProgress());

			// Start fresh
			expect(result.current.progressData.documentsCreated).toBe(0);

			// User creates their first document
			act(() => {
				result.current.incrementDocumentsCreated();
			});
			expect(result.current.progressData.documentsCreated).toBe(1);

			// User creates a journal entry
			act(() => {
				result.current.incrementJournalEntriesCreated();
			});
			expect(result.current.progressData.journalEntriesCreated).toBe(1);

			// Show the first-save hint
			act(() => {
				result.current.markHintShown("first-save");
			});
			expect(result.current.hasHintBeenShown("first-save")).toBe(true);

			// User switches project
			act(() => {
				result.current.incrementProjectsSwitched();
			});
			expect(result.current.progressData.projectsSwitched).toBe(1);

			// User creates more content
			act(() => {
				result.current.incrementDocumentsCreated();
				result.current.incrementDocumentsCreated();
				result.current.incrementDocumentsCreated();
				result.current.incrementDocumentsCreated();
			});
			expect(result.current.progressData.documentsCreated).toBe(5);

			// Show the 5-documents hint
			act(() => {
				result.current.markHintShown("recent-docs");
			});
			expect(result.current.hasHintBeenShown("recent-docs")).toBe(true);

			// Verify all data persisted
			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored).toEqual({
				documentsCreated: 5,
				journalEntriesCreated: 1,
				projectsSwitched: 1,
				hintsShown: ["first-save", "recent-docs"],
			});
		});
	});
});
