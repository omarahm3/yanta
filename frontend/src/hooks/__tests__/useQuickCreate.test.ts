import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useQuickCreate } from "../useQuickCreate";

// Mock project context
const mockCurrentProject = { alias: "personal", name: "Personal" };
let currentProjectMock: typeof mockCurrentProject | null = mockCurrentProject;

vi.mock("../../contexts", () => ({
	useProjectContext: () => ({
		currentProject: currentProjectMock,
	}),
}));

// Mock notification
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../useNotification", () => ({
	useNotification: () => ({
		success: mockSuccess,
		error: mockError,
		info: vi.fn(),
		warning: vi.fn(),
		dismiss: vi.fn(),
		dismissAll: vi.fn(),
	}),
}));

// Mock document service
const mockSaveDocument = vi.fn();

vi.mock("../../services/DocumentService", () => ({
	saveDocument: (...args: unknown[]) => mockSaveDocument(...args),
}));

// Mock journal service
const mockAppendEntry = vi.fn();

vi.mock("../../../bindings/yanta/internal/journal/wailsservice", () => ({
	AppendEntry: (...args: unknown[]) => mockAppendEntry(...args),
}));

// Mock AppendEntryRequest
vi.mock("../../../bindings/yanta/internal/journal/models", () => ({
	AppendEntryRequest: class AppendEntryRequest {
		projectAlias: string;
		content: string;
		tags: string[];
		constructor(data: { projectAlias: string; content: string; tags: string[] }) {
			this.projectAlias = data.projectAlias;
			this.content = data.content;
			this.tags = data.tags;
		}
	},
}));

// Mock createEmptyDocument utility
vi.mock("../../utils/documentBlockUtils", () => ({
	createEmptyDocument: (title?: string) => ({
		title: title || "",
		blocks: title
			? [
					{
						id: "mock-uuid",
						type: "heading",
						props: { level: 1 },
						content: [{ type: "text", text: title, styles: {} }],
					},
				]
			: [],
		tags: [],
	}),
}));

describe("useQuickCreate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		currentProjectMock = mockCurrentProject;
		mockSaveDocument.mockResolvedValue("/projects/@personal/doc-123.json");
		mockAppendEntry.mockResolvedValue({ id: "entry-123", content: "Test entry", tags: [] });
	});

	describe("initialization", () => {
		it("returns current project alias", () => {
			const { result } = renderHook(() => useQuickCreate());

			expect(result.current.currentProjectAlias).toBe("personal");
		});

		it("returns null alias when no project selected", () => {
			currentProjectMock = null;

			const { result } = renderHook(() => useQuickCreate());

			expect(result.current.currentProjectAlias).toBeNull();
		});

		it("returns isDisabled true when no project selected", () => {
			currentProjectMock = null;

			const { result } = renderHook(() => useQuickCreate());

			expect(result.current.isDisabled).toBe(true);
		});

		it("returns isDisabled false when project is selected", () => {
			const { result } = renderHook(() => useQuickCreate());

			expect(result.current.isDisabled).toBe(false);
		});
	});

	describe("handleCreateDocument", () => {
		it("creates document with correct parameters", async () => {
			const onNavigate = vi.fn();
			const { result } = renderHook(() => useQuickCreate({ onNavigate }));

			await act(async () => {
				await result.current.handleCreateDocument("My New Document");
			});

			expect(mockSaveDocument).toHaveBeenCalledWith({
				path: undefined,
				projectAlias: "personal",
				title: "My New Document",
				blocks: [
					{
						id: "mock-uuid",
						type: "heading",
						props: { level: 1 },
						content: [{ type: "text", text: "My New Document", styles: {} }],
					},
				],
				tags: [],
			});
		});

		it("shows success notification after creating document", async () => {
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateDocument("Test Document");
			});

			expect(mockSuccess).toHaveBeenCalledWith("Document created");
		});

		it("navigates to new document after creation", async () => {
			const onNavigate = vi.fn();
			mockSaveDocument.mockResolvedValue("/projects/@personal/doc-456.json");

			const { result } = renderHook(() => useQuickCreate({ onNavigate }));

			await act(async () => {
				await result.current.handleCreateDocument("Test Document");
			});

			expect(onNavigate).toHaveBeenCalledWith("document", {
				documentPath: "/projects/@personal/doc-456.json",
			});
		});

		it("does nothing for empty title", async () => {
			const onNavigate = vi.fn();
			const { result } = renderHook(() => useQuickCreate({ onNavigate }));

			await act(async () => {
				await result.current.handleCreateDocument("");
			});

			expect(mockSaveDocument).not.toHaveBeenCalled();
			expect(onNavigate).not.toHaveBeenCalled();
		});

		it("does nothing for whitespace-only title", async () => {
			const onNavigate = vi.fn();
			const { result } = renderHook(() => useQuickCreate({ onNavigate }));

			await act(async () => {
				await result.current.handleCreateDocument("   ");
			});

			expect(mockSaveDocument).not.toHaveBeenCalled();
			expect(onNavigate).not.toHaveBeenCalled();
		});

		it("shows error when no project selected", async () => {
			currentProjectMock = null;
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateDocument("Test Document");
			});

			expect(mockError).toHaveBeenCalledWith("No project selected");
			expect(mockSaveDocument).not.toHaveBeenCalled();
		});

		it("shows error when save fails", async () => {
			mockSaveDocument.mockRejectedValue(new Error("Save failed"));
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateDocument("Test Document");
			});

			expect(mockError).toHaveBeenCalledWith("Failed to create document: Save failed");
		});

		it("handles non-Error rejection", async () => {
			mockSaveDocument.mockRejectedValue("Some string error");
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateDocument("Test Document");
			});

			expect(mockError).toHaveBeenCalledWith("Failed to create document: Unknown error");
		});

		it("does not navigate when save fails", async () => {
			const onNavigate = vi.fn();
			mockSaveDocument.mockRejectedValue(new Error("Save failed"));
			const { result } = renderHook(() => useQuickCreate({ onNavigate }));

			await act(async () => {
				await result.current.handleCreateDocument("Test Document");
			});

			expect(onNavigate).not.toHaveBeenCalled();
		});

		it("works without onNavigate callback", async () => {
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateDocument("Test Document");
			});

			expect(mockSuccess).toHaveBeenCalledWith("Document created");
		});
	});

	describe("handleCreateJournalEntry", () => {
		it("creates journal entry with correct parameters", async () => {
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("My journal note");
			});

			expect(mockAppendEntry).toHaveBeenCalledWith(
				expect.objectContaining({
					projectAlias: "personal",
					content: "My journal note",
					tags: [],
				}),
			);
		});

		it("trims whitespace from content", async () => {
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("  My journal note  ");
			});

			expect(mockAppendEntry).toHaveBeenCalledWith(
				expect.objectContaining({
					content: "My journal note",
				}),
			);
		});

		it("shows success notification after creating journal entry", async () => {
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("Test entry");
			});

			expect(mockSuccess).toHaveBeenCalledWith("Journal entry added");
		});

		it("does nothing for empty content", async () => {
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("");
			});

			expect(mockAppendEntry).not.toHaveBeenCalled();
			expect(mockSuccess).not.toHaveBeenCalled();
		});

		it("does nothing for whitespace-only content", async () => {
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("   ");
			});

			expect(mockAppendEntry).not.toHaveBeenCalled();
			expect(mockSuccess).not.toHaveBeenCalled();
		});

		it("shows error when no project selected", async () => {
			currentProjectMock = null;
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("Test entry");
			});

			expect(mockError).toHaveBeenCalledWith("No project selected");
			expect(mockAppendEntry).not.toHaveBeenCalled();
		});

		it("shows error when AppendEntry fails", async () => {
			mockAppendEntry.mockRejectedValue(new Error("Journal save failed"));
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("Test entry");
			});

			expect(mockError).toHaveBeenCalledWith("Failed to create journal entry: Journal save failed");
		});

		it("handles non-Error rejection", async () => {
			mockAppendEntry.mockRejectedValue("Some string error");
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("Test entry");
			});

			expect(mockError).toHaveBeenCalledWith("Failed to create journal entry: Unknown error");
		});

		it("does not navigate after journal entry creation", async () => {
			const onNavigate = vi.fn();
			const { result } = renderHook(() => useQuickCreate({ onNavigate }));

			await act(async () => {
				await result.current.handleCreateJournalEntry("Test entry");
			});

			expect(onNavigate).not.toHaveBeenCalled();
		});

		it("does not show success notification when AppendEntry fails", async () => {
			mockAppendEntry.mockRejectedValue(new Error("Failed"));
			const { result } = renderHook(() => useQuickCreate());

			await act(async () => {
				await result.current.handleCreateJournalEntry("Test entry");
			});

			expect(mockSuccess).not.toHaveBeenCalled();
		});
	});
});
