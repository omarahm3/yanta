import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlainTextClipboard } from "../editor/hooks/usePlainTextClipboard";

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
	// The hook attaches its copy listener to the container element (not document),
	// so spy on the element prototype to observe add/remove across any container.
	let addSpy: ReturnType<typeof vi.spyOn>;
	let removeSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");
		removeSpy = vi.spyOn(HTMLElement.prototype, "removeEventListener");
	});

	afterEach(() => {
		document.body.removeChild(container);
		vi.restoreAllMocks();
	});

	describe("event listener management", () => {
		it("attaches copy event listener to the container when provided", () => {
			renderHook(() => usePlainTextClipboard(container));

			expect(addSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("does not attach listener when container is null", () => {
			renderHook(() => usePlainTextClipboard(null));

			expect(addSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("does not attach listener when enabled is false", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: false }));

			expect(addSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("removes event listener on unmount", () => {
			const { unmount } = renderHook(() => usePlainTextClipboard(container));

			unmount();

			expect(removeSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("removes and re-attaches listener when container changes", () => {
			const newContainer = document.createElement("div");
			document.body.appendChild(newContainer);

			const { rerender } = renderHook(({ cont }) => usePlainTextClipboard(cont), {
				initialProps: { cont: container },
			});

			addSpy.mockClear();
			removeSpy.mockClear();

			rerender({ cont: newContainer });

			expect(removeSpy).toHaveBeenCalledWith("copy", expect.any(Function));
			expect(addSpy).toHaveBeenCalledWith("copy", expect.any(Function));

			document.body.removeChild(newContainer);
		});

		it("removes listener when enabled changes to false", () => {
			const { rerender } = renderHook(({ enabled }) => usePlainTextClipboard(container, { enabled }), {
				initialProps: { enabled: true },
			});

			removeSpy.mockClear();

			rerender({ enabled: false });

			expect(removeSpy).toHaveBeenCalledWith("copy", expect.any(Function));
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

			targetElement.dispatchEvent(copyEvent);

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

			outsideElement.dispatchEvent(copyEvent);

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

			targetElement.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();
		});

		it("does not set clipboard data when selection is null", () => {
			renderHook(() => usePlainTextClipboard(container));

			const targetElement = document.createElement("span");
			container.appendChild(targetElement);

			vi.spyOn(window, "getSelection").mockReturnValue(null);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(targetElement, clipboardData);

			targetElement.dispatchEvent(copyEvent);

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

			targetElement.dispatchEvent(copyEvent);

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

			expect(() => targetElement.dispatchEvent(copyEvent)).not.toThrow();
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

			targetElement.dispatchEvent(copyEvent);

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

			targetElement.dispatchEvent(copyEvent);

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

			targetElement.dispatchEvent(copyEvent);

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

			targetElement.dispatchEvent(copyEvent);

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

			targetElement.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", urlText);
		});
	});

	describe("enabled option", () => {
		it("defaults to enabled when option is not provided", () => {
			renderHook(() => usePlainTextClipboard(container));

			expect(addSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("defaults to enabled when options object is empty", () => {
			renderHook(() => usePlainTextClipboard(container, {}));

			expect(addSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("is enabled when explicitly set to true", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: true }));

			expect(addSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("is disabled when explicitly set to false", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: false }));

			expect(addSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));
		});

		it("can be toggled at runtime", () => {
			const { rerender } = renderHook(({ enabled }) => usePlainTextClipboard(container, { enabled }), {
				initialProps: { enabled: false },
			});

			expect(addSpy).not.toHaveBeenCalledWith("copy", expect.any(Function));

			addSpy.mockClear();

			rerender({ enabled: true });

			expect(addSpy).toHaveBeenCalledWith("copy", expect.any(Function));
		});
	});
});
