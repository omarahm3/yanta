import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlainTextClipboard } from "../components/editor/hooks/usePlainTextClipboard";

/**
 * Helper to create a mock ClipboardEvent since jsdom doesn't fully support it.
 */
function createMockClipboardEvent(
	target: Node,
	clipboardData: { setData: ReturnType<typeof vi.fn> } | null,
): Event {
	const event = new Event("copy", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "target", {
		value: target,
		writable: false,
	});
	Object.defineProperty(event, "clipboardData", {
		value: clipboardData,
		writable: false,
	});
	return event;
}

describe("usePlainTextClipboard", () => {
	let container: HTMLDivElement;
	let documentAddSpy: ReturnType<typeof vi.spyOn>;
	let documentRemoveSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		documentAddSpy = vi.spyOn(document, "addEventListener");
		documentRemoveSpy = vi.spyOn(document, "removeEventListener");
	});

	afterEach(() => {
		document.body.removeChild(container);
		vi.restoreAllMocks();
	});

	describe("event listener management", () => {
		it("attaches copy event listener to document when container is provided", () => {
			renderHook(() => usePlainTextClipboard(container));

			expect(documentAddSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("does not attach listener when container is null", () => {
			renderHook(() => usePlainTextClipboard(null));

			expect(documentAddSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("does not attach listener when enabled is false", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: false }));

			expect(documentAddSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("removes event listener on unmount", () => {
			const { unmount } = renderHook(() => usePlainTextClipboard(container));

			unmount();

			expect(documentRemoveSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("removes and re-attaches listener when container changes", () => {
			const newContainer = document.createElement("div");
			document.body.appendChild(newContainer);

			const { rerender } = renderHook(({ cont }) => usePlainTextClipboard(cont), {
				initialProps: { cont: container },
			});

			documentAddSpy.mockClear();
			documentRemoveSpy.mockClear();

			rerender({ cont: newContainer });

			expect(documentRemoveSpy).toHaveBeenCalledWith("copy", expect.any(Function));
			expect(documentAddSpy).toHaveBeenCalledWith("copy", expect.any(Function));

			document.body.removeChild(newContainer);
		});

		it("removes listener when enabled changes to false", () => {
			const { rerender } = renderHook(({ enabled }) => usePlainTextClipboard(container, { enabled }), {
				initialProps: { enabled: true },
			});

			documentRemoveSpy.mockClear();

			rerender({ enabled: false });

			expect(documentRemoveSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});
	});

	describe("copy event handling", () => {
		it("sets text/plain clipboard data with selected text", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const mockSelection = {
				isCollapsed: false,
				toString: () => "Hello World",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", "Hello World");
		});

		it("does not set clipboard data when target is outside container", () => {
			renderHook(() => usePlainTextClipboard(container));

			const outsideElement = document.createElement("span");
			document.body.appendChild(outsideElement);

			const mockSelection = {
				isCollapsed: false,
				toString: () => "Hello World",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(outsideElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();

			document.body.removeChild(outsideElement);
		});

		it("does not set clipboard data when selection is collapsed", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const mockSelection = {
				isCollapsed: true,
				toString: () => "",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();
		});

		it("does not set clipboard data when selection is null", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			vi.spyOn(window, "getSelection").mockReturnValue(null);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();
		});

		it("does not set clipboard data when selected text is empty", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const mockSelection = {
				isCollapsed: false,
				toString: () => "",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();
		});

		it("does nothing when clipboardData is null", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const mockSelection = {
				isCollapsed: false,
				toString: () => "Hello World",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const copyEvent = createMockClipboardEvent(targetElement, null);

			expect(() => document.dispatchEvent(copyEvent)).not.toThrow();
		});

		it("handles multiline text selection", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const multilineText = "Line 1\nLine 2\nLine 3";
			const mockSelection = {
				isCollapsed: false,
				toString: () => multilineText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", multilineText);
		});

		it("handles text with special characters", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const specialText = "Hello <World> & \"Friends\" 'Family'";
			const mockSelection = {
				isCollapsed: false,
				toString: () => specialText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", specialText);
		});

		it("handles unicode text", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const unicodeText = "Hello 世界 🌍 مرحبا";
			const mockSelection = {
				isCollapsed: false,
				toString: () => unicodeText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", unicodeText);
		});

		it("copies link text without markdown syntax", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const linkVisualText = "Click here";
			const mockSelection = {
				isCollapsed: false,
				toString: () => linkVisualText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", linkVisualText);
		});

		it("copies URL without angle brackets", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			const urlText = "https://example.com/path";
			const mockSelection = {
				isCollapsed: false,
				toString: () => urlText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			document.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", urlText);
		});
	});

	describe("enabled option", () => {
		it("defaults to enabled when option is not provided", () => {
			renderHook(() => usePlainTextClipboard(container));

			expect(documentAddSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("defaults to enabled when options object is empty", () => {
			renderHook(() => usePlainTextClipboard(container, {}));

			expect(documentAddSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("is enabled when explicitly set to true", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: true }));

			expect(documentAddSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("is disabled when explicitly set to false", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: false }));

			expect(documentAddSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("can be toggled at runtime", () => {
			const { rerender } = renderHook(({ enabled }) => usePlainTextClipboard(container, { enabled }), {
				initialProps: { enabled: false },
			});

			expect(documentAddSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));

			documentAddSpy.mockClear();

			rerender({ enabled: true });

			expect(documentAddSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});
	});
});
