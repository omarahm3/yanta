import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJournal } from "../useJournal";

// Mock the journal service
vi.mock("../../../../bindings/yanta/internal/journal/wailsservice", () => ({
	GetActiveEntries: vi.fn(),
	DeleteEntry: vi.fn(),
	RestoreEntry: vi.fn(),
	ListDates: vi.fn(),
	PromoteToDocument: vi.fn(),
}));

const mockEntries = [
	{
		id: "abc123",
		content: "Fix the auth bug",
		tags: ["urgent", "backend"],
		created: "2026-01-30T09:15:00Z",
	},
	{
		id: "def456",
		content: "Call dentist",
		tags: [],
		created: "2026-01-30T11:30:00Z",
	},
];

describe("useJournal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches today by default", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		mockGet.mockResolvedValue(mockEntries);

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(mockGet).toHaveBeenCalledWith(
			"personal",
			expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
		);
		expect(result.current.entries).toHaveLength(2);
	});

	it("fetches specific date", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		mockGet.mockResolvedValue(mockEntries);

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal", date: "2026-01-15" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(mockGet).toHaveBeenCalledWith("personal", "2026-01-15");
	});

	it("handles empty state", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		mockGet.mockResolvedValue([]);

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.entries).toHaveLength(0);
		expect(result.current.isEmpty).toBe(true);
	});

	it("deletes entry", async () => {
		const { GetActiveEntries, DeleteEntry } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		const mockDelete = DeleteEntry as ReturnType<typeof vi.fn>;

		mockGet.mockResolvedValue(mockEntries);
		mockDelete.mockResolvedValue(undefined);

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal", date: "2026-01-30" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		await act(async () => {
			await result.current.deleteEntry("abc123");
		});

		expect(mockDelete).toHaveBeenCalledWith("personal", "2026-01-30", "abc123");
	});

	it("handles promote to document", async () => {
		const { GetActiveEntries, PromoteToDocument } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		const mockPromote = PromoteToDocument as ReturnType<typeof vi.fn>;

		mockGet.mockResolvedValue(mockEntries);
		mockPromote.mockResolvedValue("projects/work/doc-123.json");

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal", date: "2026-01-30" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		let documentPath: string | undefined;
		await act(async () => {
			documentPath = await result.current.promoteToDocument({
				entryIds: ["abc123"],
				targetProject: "work",
				title: "Bug Fix Notes",
				keepOriginal: false,
			});
		});

		expect(mockPromote).toHaveBeenCalledWith({
			sourceProject: "personal",
			date: "2026-01-30",
			entryIds: ["abc123"],
			targetProject: "work",
			title: "Bug Fix Notes",
			keepOriginal: false,
		});
		expect(documentPath).toBe("projects/work/doc-123.json");
	});

	it("refreshes entries on date change", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		mockGet.mockResolvedValue(mockEntries);

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal", date: "2026-01-30" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(mockGet).toHaveBeenCalledWith("personal", "2026-01-30");

		// Change date using the setDate method
		act(() => {
			result.current.setDate("2026-01-29");
		});

		await waitFor(() => {
			expect(mockGet).toHaveBeenCalledWith("personal", "2026-01-29");
		});
	});

	it("handles selection", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		mockGet.mockResolvedValue(mockEntries);

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.toggleSelection("abc123");
		});

		expect(result.current.selectedIds.has("abc123")).toBe(true);

		act(() => {
			result.current.toggleSelection("abc123");
		});

		expect(result.current.selectedIds.has("abc123")).toBe(false);
	});

	it("clears selection", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		mockGet.mockResolvedValue(mockEntries);

		const { result } = renderHook(() =>
			useJournal({ projectAlias: "personal" })
		);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.toggleSelection("abc123");
			result.current.toggleSelection("def456");
		});

		expect(result.current.selectedIds.size).toBe(2);

		act(() => {
			result.current.clearSelection();
		});

		expect(result.current.selectedIds.size).toBe(0);
	});
});
