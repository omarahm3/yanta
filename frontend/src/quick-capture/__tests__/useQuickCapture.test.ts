import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickCapture } from "../useQuickCapture";

// Mock the journal service
vi.mock("../../../bindings/yanta/internal/journal/wailsservice", () => ({
	AppendEntry: vi.fn(),
}));

// Mock the project service
vi.mock("../../../bindings/yanta/internal/project/service", () => ({
	ListActive: vi.fn(),
}));

// Mock localStorage
const originalLocalStorage = window.localStorage;
const mockLocalStorage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		clear: () => {
			store = {};
		},
	};
})();

Object.defineProperty(window, "localStorage", {
	value: mockLocalStorage,
	configurable: true,
});

describe("useQuickCapture", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLocalStorage.clear();
	});

	afterAll(() => {
		Object.defineProperty(window, "localStorage", {
			value: originalLocalStorage,
			configurable: true,
		});
	});

	it("initializes with empty content", () => {
		const { result } = renderHook(() => useQuickCapture());

		expect(result.current.content).toBe("");
		expect(result.current.tags).toEqual([]);
	});

	it("updates content and extracts tags", () => {
		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Fix bug #urgent #backend");
		});

		expect(result.current.content).toBe("Fix bug #urgent #backend");
		expect(result.current.tags).toEqual(["urgent", "backend"]);
	});

	it("updates project from inline @syntax", () => {
		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Note @work");
		});

		expect(result.current.selectedProject).toBe("work");
	});

	it("saves entry via JournalService", async () => {
		const { AppendEntry } = await import("../../../bindings/yanta/internal/journal/wailsservice");
		const mockAppendEntry = AppendEntry as ReturnType<typeof vi.fn>;
		mockAppendEntry.mockResolvedValue({ id: "abc123", content: "Test" });

		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Test note #tag @project");
			result.current.setSelectedProject("project");
		});

		await act(async () => {
			await result.current.save();
		});

		expect(mockAppendEntry).toHaveBeenCalledWith(
			expect.objectContaining({
				projectAlias: "@project",
				content: "Test note",
				tags: ["tag"],
			}),
		);
	});

	it("clears content after save", async () => {
		const { AppendEntry } = await import("../../../bindings/yanta/internal/journal/wailsservice");
		const mockAppendEntry = AppendEntry as ReturnType<typeof vi.fn>;
		mockAppendEntry.mockResolvedValue({ id: "abc123", content: "Test" });

		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Test note");
			result.current.setSelectedProject("project");
		});

		await act(async () => {
			await result.current.save();
		});

		expect(result.current.content).toBe("");
	});

	it("clears tags after save", async () => {
		const { AppendEntry } = await import("../../../bindings/yanta/internal/journal/wailsservice");
		const mockAppendEntry = AppendEntry as ReturnType<typeof vi.fn>;
		mockAppendEntry.mockResolvedValue({ id: "abc123", content: "Test" });

		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Test #urgent #backend");
			result.current.setSelectedProject("project");
		});

		await act(async () => {
			await result.current.save();
		});

		expect(result.current.tags).toEqual([]);
	});

	it("remembers last project in localStorage", async () => {
		const { AppendEntry } = await import("../../../bindings/yanta/internal/journal/wailsservice");
		const mockAppendEntry = AppendEntry as ReturnType<typeof vi.fn>;
		mockAppendEntry.mockResolvedValue({ id: "abc123", content: "Test" });

		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Test");
			result.current.setSelectedProject("work");
		});

		await act(async () => {
			await result.current.save();
		});

		expect(mockLocalStorage.setItem).toHaveBeenCalledWith("yanta:lastProject", "@work");
	});

	it("handles save error", async () => {
		const { AppendEntry } = await import("../../../bindings/yanta/internal/journal/wailsservice");
		const mockAppendEntry = AppendEntry as ReturnType<typeof vi.fn>;
		mockAppendEntry.mockRejectedValue(new Error("Network error"));

		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Test note");
			result.current.setSelectedProject("project");
		});

		await act(async () => {
			try {
				await result.current.save();
			} catch {
				// Expected to throw
			}
		});

		// Content should NOT be cleared on error
		expect(result.current.content).toBe("Test note");
		expect(result.current.error).toBe("Failed to save. Try again.");
	});

	it("removes individual tags", () => {
		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Fix bug #urgent #backend");
		});

		expect(result.current.tags).toEqual(["urgent", "backend"]);

		act(() => {
			result.current.removeTag("urgent");
		});

		// Content should be updated to remove the tag
		expect(result.current.content).toBe("Fix bug #backend");
		expect(result.current.tags).toEqual(["backend"]);
	});

	it("clears all state", () => {
		const { result } = renderHook(() => useQuickCapture());

		act(() => {
			result.current.setContent("Fix bug #urgent");
		});

		act(() => {
			result.current.clear();
		});

		expect(result.current.content).toBe("");
		expect(result.current.tags).toEqual([]);
	});
});
