import { act, renderHook, waitFor } from "@testing-library/react";
import { Events } from "@wailsio/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentDocuments } from "../hooks/useRecentDocuments";
import { useRecentDocumentsStore } from "../shared/stores/recentDocuments.store";

vi.mock("../services/DocumentService", () => ({
	getDocument: vi.fn((path: string) =>
		Promise.resolve({
			path,
			title: "", // Empty so we keep stored title
			projectAlias: "proj",
			blocks: [],
			tags: [],
			deletedAt: undefined,
		}),
	),
}));

const STORAGE_KEY = "yanta_recent_documents";

describe("useRecentDocuments", () => {
	beforeEach(() => {
		localStorage.clear();
		useRecentDocumentsStore.setState({ documents: [] });
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("should return empty array when no data in localStorage", () => {
			const { result } = renderHook(() => useRecentDocuments());

			expect(result.current.recentDocuments).toEqual([]);
		});

		it("should load existing documents from localStorage", async () => {
			vi.useRealTimers();
			const existingDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
				{ path: "/doc2", title: "Doc 2", projectAlias: "proj2", lastOpened: 2000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			await waitFor(() => {
				expect(result.current.recentDocuments).toEqual(existingDocs);
			});
			vi.useFakeTimers();
		});

		it("should handle invalid JSON in localStorage", () => {
			localStorage.setItem(STORAGE_KEY, "not valid json");

			const { result } = renderHook(() => useRecentDocuments());

			expect(result.current.recentDocuments).toEqual([]);
		});

		it("should filter out invalid documents from localStorage", async () => {
			vi.useRealTimers();
			const mixedDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
				{ path: 123, title: "Invalid", projectAlias: "proj1", lastOpened: 2000 }, // invalid path
				{ path: "/doc2", title: "Doc 2", projectAlias: "proj2", lastOpened: 3000 },
				null, // null entry
				{ path: "/doc3" }, // missing fields
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(mixedDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			await waitFor(() => {
				expect(result.current.recentDocuments).toHaveLength(2);
				expect(result.current.recentDocuments[0].path).toBe("/doc1");
				expect(result.current.recentDocuments[1].path).toBe("/doc2");
			});
			vi.useFakeTimers();
		});

		it("should handle non-array data in localStorage", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));

			const { result } = renderHook(() => useRecentDocuments());

			expect(result.current.recentDocuments).toEqual([]);
		});
	});

	describe("addRecentDocument", () => {
		it("should add a new document to the front of the list", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useRecentDocuments());

			act(() => {
				result.current.addRecentDocument({
					path: "/doc1",
					title: "Doc 1",
					projectAlias: "proj1",
				});
			});

			expect(result.current.recentDocuments).toHaveLength(1);
			expect(result.current.recentDocuments[0]).toEqual({
				path: "/doc1",
				title: "Doc 1",
				projectAlias: "proj1",
				lastOpened: 5000,
			});
		});

		it("should persist to localStorage", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useRecentDocuments());

			act(() => {
				result.current.addRecentDocument({
					path: "/doc1",
					title: "Doc 1",
					projectAlias: "proj1",
				});
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
			expect(stored).toHaveLength(1);
			expect(stored[0].path).toBe("/doc1");
		});

		it("should move existing document to front when re-opened", () => {
			vi.setSystemTime(new Date(1000));
			const { result } = renderHook(() => useRecentDocuments());

			act(() => {
				result.current.addRecentDocument({
					path: "/doc1",
					title: "Doc 1",
					projectAlias: "proj1",
				});
			});

			vi.setSystemTime(new Date(2000));
			act(() => {
				result.current.addRecentDocument({
					path: "/doc2",
					title: "Doc 2",
					projectAlias: "proj2",
				});
			});

			vi.setSystemTime(new Date(3000));
			act(() => {
				result.current.addRecentDocument({
					path: "/doc1",
					title: "Doc 1 Updated",
					projectAlias: "proj1",
				});
			});

			expect(result.current.recentDocuments).toHaveLength(2);
			expect(result.current.recentDocuments[0].path).toBe("/doc1");
			expect(result.current.recentDocuments[0].title).toBe("Doc 1 Updated");
			expect(result.current.recentDocuments[0].lastOpened).toBe(3000);
			expect(result.current.recentDocuments[1].path).toBe("/doc2");
		});

		it("should trim list to 10 items maximum", () => {
			const { result } = renderHook(() => useRecentDocuments());

			for (let i = 0; i < 15; i++) {
				vi.setSystemTime(new Date(i * 1000));
				act(() => {
					result.current.addRecentDocument({
						path: `/doc${i}`,
						title: `Doc ${i}`,
						projectAlias: "proj1",
					});
				});
			}

			expect(result.current.recentDocuments).toHaveLength(10);
			// Most recent should be first
			expect(result.current.recentDocuments[0].path).toBe("/doc14");
			// Oldest kept should be doc5
			expect(result.current.recentDocuments[9].path).toBe("/doc5");
		});

		it("should update title when same document is opened", () => {
			vi.setSystemTime(new Date(1000));
			const { result } = renderHook(() => useRecentDocuments());

			act(() => {
				result.current.addRecentDocument({
					path: "/doc1",
					title: "Original Title",
					projectAlias: "proj1",
				});
			});

			vi.setSystemTime(new Date(2000));
			act(() => {
				result.current.addRecentDocument({
					path: "/doc1",
					title: "Updated Title",
					projectAlias: "proj1",
				});
			});

			expect(result.current.recentDocuments).toHaveLength(1);
			expect(result.current.recentDocuments[0].title).toBe("Updated Title");
		});
	});

	describe("clearRecentDocuments", () => {
		it("should clear all documents", async () => {
			const existingDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
				{ path: "/doc2", title: "Doc 2", projectAlias: "proj2", lastOpened: 2000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());
			expect(result.current.recentDocuments).toHaveLength(2);

			act(() => {
				result.current.clearRecentDocuments();
			});

			expect(result.current.recentDocuments).toEqual([]);
		});

		it("should remove data from localStorage", async () => {
			const existingDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			act(() => {
				result.current.clearRecentDocuments();
			});

			expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		});
	});

	describe("cross-tab synchronization", () => {
		it("should update when storage event is fired", async () => {
			vi.useRealTimers();
			const { result } = renderHook(() => useRecentDocuments());

			const newDocs = [{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 }];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));

			act(() => {
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: STORAGE_KEY,
						newValue: JSON.stringify(newDocs),
					}),
				);
			});

			await waitFor(() => {
				expect(result.current.recentDocuments).toEqual(newDocs);
			});
			vi.useFakeTimers();
		});

		it("should ignore storage events for other keys", async () => {
			const existingDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			act(() => {
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: "some_other_key",
						newValue: "[]",
					}),
				);
			});

			expect(result.current.recentDocuments).toEqual(existingDocs);
		});
	});

	describe("Wails event listeners", () => {
		function getEventCallback(eventName: string): (ev: unknown) => void {
			const calls = vi.mocked(Events.On).mock.calls;
			const match = calls.find(([name]) => name === eventName);
			if (!match) throw new Error(`No Events.On call found for "${eventName}"`);
			return match[1] as (ev: unknown) => void;
		}

		it("should update title when yanta/entry/updated event fires for a matching doc", async () => {
			vi.useRealTimers();
			const existingDocs = [
				{ path: "/doc1", title: "Old Title", projectAlias: "proj1", lastOpened: 1000 },
				{ path: "/doc2", title: "Doc 2", projectAlias: "proj2", lastOpened: 2000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			await waitFor(() => {
				expect(result.current.recentDocuments).toHaveLength(2);
			});

			const onUpdated = getEventCallback("yanta/entry/updated");
			act(() => {
				onUpdated({ data: { path: "/doc1", title: "New Title" } });
			});

			expect(result.current.recentDocuments[0].title).toBe("New Title");
			expect(result.current.recentDocuments[0].path).toBe("/doc1");
			// Other docs unchanged
			expect(result.current.recentDocuments[1]).toEqual(existingDocs[1]);
			// Persisted to localStorage
			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
			expect(stored[0].title).toBe("New Title");
			vi.useFakeTimers();
		});

		it("should be a no-op when yanta/entry/updated fires for a non-matching path", async () => {
			vi.useRealTimers();
			const existingDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			await waitFor(() => {
				expect(result.current.recentDocuments).toHaveLength(1);
			});

			const onUpdated = getEventCallback("yanta/entry/updated");
			act(() => {
				onUpdated({ data: { path: "/nonexistent", title: "Whatever" } });
			});

			expect(result.current.recentDocuments).toEqual(existingDocs);
			vi.useFakeTimers();
		});

		it("should remove doc when yanta/entry/deleted event fires for a matching doc", async () => {
			vi.useRealTimers();
			const existingDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
				{ path: "/doc2", title: "Doc 2", projectAlias: "proj2", lastOpened: 2000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			await waitFor(() => {
				expect(result.current.recentDocuments).toHaveLength(2);
			});

			const onDeleted = getEventCallback("yanta/entry/deleted");
			act(() => {
				onDeleted({ data: { path: "/doc1" } });
			});

			expect(result.current.recentDocuments).toHaveLength(1);
			expect(result.current.recentDocuments[0].path).toBe("/doc2");
			// Persisted to localStorage
			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
			expect(stored).toHaveLength(1);
			expect(stored[0].path).toBe("/doc2");
			vi.useFakeTimers();
		});

		it("should be a no-op when yanta/entry/deleted fires for a non-matching path", async () => {
			vi.useRealTimers();
			const existingDocs = [
				{ path: "/doc1", title: "Doc 1", projectAlias: "proj1", lastOpened: 1000 },
			];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDocs));
			await useRecentDocumentsStore.persist.rehydrate();

			const { result } = renderHook(() => useRecentDocuments());

			await waitFor(() => {
				expect(result.current.recentDocuments).toHaveLength(1);
			});

			const onDeleted = getEventCallback("yanta/entry/deleted");
			act(() => {
				onDeleted({ data: { path: "/nonexistent" } });
			});

			expect(result.current.recentDocuments).toEqual(existingDocs);
			vi.useFakeTimers();
		});
	});
});
