import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalController } from "../useJournalController";

// Mock project context
vi.mock("../../project", () => ({
	useProjectContext: () => ({
		currentProject: { alias: "personal", name: "Personal" },
	}),
}));

// Mock shared hooks with stable references (avoid infinite re-render loops)
const mockNotify = {
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warning: vi.fn(),
};
vi.mock("../../shared/hooks", () => ({
	useSidebarSections: () => [],
	useNotification: () => mockNotify,
}));

// Mock help hook
vi.mock("../../help", () => ({
	useHelp: () => ({
		setPageContext: vi.fn(),
	}),
}));

// Mock journal service
vi.mock("../../../bindings/yanta/internal/journal/wailsservice", () => ({
	GetActiveEntries: vi.fn(() =>
		Promise.resolve([
			{
				id: "entry1",
				content: "First entry",
				tags: ["tag1"],
				created: "2026-01-30T09:00:00Z",
			},
			{
				id: "entry2",
				content: "Second entry",
				tags: [],
				created: "2026-01-30T10:00:00Z",
			},
			{
				id: "entry3",
				content: "Third entry",
				tags: [],
				created: "2026-01-30T11:00:00Z",
			},
		]),
	),
	DeleteEntry: vi.fn(() => Promise.resolve()),
	ListDates: vi.fn(() => Promise.resolve(["2026-01-30"])),
	PromoteToDocument: vi.fn(() => Promise.resolve("path/to/doc")),
}));

describe("useJournalController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("initializes with entries", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});
	});

	it("highlights next entry with j key handler", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		expect(result.current.highlightedIndex).toBe(0);

		act(() => {
			result.current.highlightNext();
		});

		expect(result.current.highlightedIndex).toBe(1);
	});

	it("highlights previous entry with k key handler", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		// Move to second entry first
		act(() => {
			result.current.setHighlightedIndex(2);
		});

		expect(result.current.highlightedIndex).toBe(2);

		act(() => {
			result.current.highlightPrevious();
		});

		expect(result.current.highlightedIndex).toBe(1);
	});

	it("does not go below 0 when highlighting previous", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		expect(result.current.highlightedIndex).toBe(0);

		act(() => {
			result.current.highlightPrevious();
		});

		expect(result.current.highlightedIndex).toBe(0);
	});

	it("does not go above max when highlighting next", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		// Move to last entry
		act(() => {
			result.current.setHighlightedIndex(2);
		});

		act(() => {
			result.current.highlightNext();
		});

		expect(result.current.highlightedIndex).toBe(2);
	});

	it("toggles selection for highlighted entry", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		expect(result.current.selectedIds.size).toBe(0);

		act(() => {
			result.current.toggleSelection();
		});

		expect(result.current.selectedIds.size).toBe(1);
		expect(result.current.selectedIds.has("entry1")).toBe(true);
	});

	it("toggles selection for specific entry id", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		act(() => {
			result.current.toggleSelection("entry2");
		});

		expect(result.current.selectedIds.size).toBe(1);
		expect(result.current.selectedIds.has("entry2")).toBe(true);
	});

	it("clears selection", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		act(() => {
			result.current.toggleSelection("entry1");
			result.current.toggleSelection("entry2");
		});

		expect(result.current.selectedIds.size).toBe(2);

		act(() => {
			result.current.clearSelection();
		});

		expect(result.current.selectedIds.size).toBe(0);
	});

	it("provides hotkey configs without selectAll and Enter", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		expect(result.current.hotkeys).toBeDefined();
		expect(result.current.hotkeys.length).toBeGreaterThan(0);

		// Verify specific hotkeys exist
		const keys = result.current.hotkeys.map((h) => h.key);
		expect(keys).toContain("j");
		expect(keys).toContain("k");
		expect(keys).toContain("ArrowDown");
		expect(keys).toContain("ArrowUp");
		expect(keys).toContain("Space");
		expect(keys).toContain("mod+D");
		expect(keys).toContain("mod+shift+p");
		expect(keys).toContain("ctrl+n");
		expect(keys).toContain("ctrl+p");
		expect(keys).toContain("ArrowLeft");
		expect(keys).toContain("ArrowRight");

		// Verify removed hotkeys are not present
		expect(keys).not.toContain("mod+A");
		expect(keys).not.toContain("Enter");
	});

	it("updates highlighted index on entry click", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		act(() => {
			result.current.handleEntryClick("entry3");
		});

		expect(result.current.highlightedIndex).toBe(2);
	});

	it("provides status bar data", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		expect(result.current.statusBar.totalEntries).toBe(3);
		expect(result.current.statusBar.currentContext).toBe("personal");
		expect(result.current.statusBar.selectedCount).toBe(0);

		act(() => {
			result.current.toggleSelection();
		});

		expect(result.current.statusBar.selectedCount).toBe(1);
	});

	it("opens confirm dialog when deleting selected entries", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		// Select an entry first
		act(() => {
			result.current.toggleSelection("entry1");
		});

		expect(result.current.confirmDialog.isOpen).toBe(false);

		// Trigger delete
		act(() => {
			result.current.handleDeleteSelected();
		});

		expect(result.current.confirmDialog.isOpen).toBe(true);
		expect(result.current.confirmDialog.title).toBe("Delete Journal Entry");
		expect(result.current.confirmDialog.danger).toBe(true);
	});

	it("shows plural message when deleting multiple entries", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		// Select multiple entries
		act(() => {
			result.current.toggleSelection("entry1");
			result.current.toggleSelection("entry2");
		});

		// Trigger delete
		act(() => {
			result.current.handleDeleteSelected();
		});

		expect(result.current.confirmDialog.isOpen).toBe(true);
		expect(result.current.confirmDialog.title).toBe("Delete Journal Entries");
		expect(result.current.confirmDialog.message).toContain("2 journal entries");
	});

	it("does not open dialog when no entries selected", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		// Try to delete with no selection
		act(() => {
			result.current.handleDeleteSelected();
		});

		expect(result.current.confirmDialog.isOpen).toBe(false);
	});

	it("provides confirmDialog state", async () => {
		const { result } = renderHook(() => useJournalController({ onNavigate: vi.fn() }));

		await waitFor(() => {
			expect(result.current.entries).toHaveLength(3);
		});

		expect(result.current.confirmDialog).toBeDefined();
		expect(result.current.confirmDialog.isOpen).toBe(false);
		expect(result.current.setConfirmDialog).toBeDefined();
	});
});
