import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePlainTextClipboard } from "../components/editor/hooks/usePlainTextClipboard";

/**
 * Helper to create a mock ClipboardEvent since jsdom doesn't fully support it.
 * Uses Event as base and adds clipboardData property.
 */
function createMockClipboardEvent(
	clipboardData: { setData: ReturnType<typeof vi.fn> } | null,
): Event {
	const event = new Event("copy", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: clipboardData,
		writable: false,
	});
	return event;
}

describe("usePlainTextClipboard", () => {
	let container: HTMLDivElement;
	let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
	let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		addEventListenerSpy = vi.spyOn(container, "addEventListener");
		removeEventListenerSpy = vi.spyOn(container, "removeEventListener");
	});

	afterEach(() => {
		document.body.removeChild(container);
		vi.restoreAllMocks();
	});

	describe("event listener management", () => {
		it("attaches copy event listener when container is provided", () => {
			renderHook(() => usePlainTextClipboard(container));

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"copy",
				expect.any(Function),
				true,
			);
		});

		it("uses capture phase for the event listener", () => {
			renderHook(() => usePlainTextClipboard(container));

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"copy",
				expect.any(Function),
				true,
			);
		});

		it("does not attach listener when container is null", () => {
			renderHook(() => usePlainTextClipboard(null));

			expect(addEventListenerSpy).not.toHaveBeenCalled();
		});

		it("does not attach listener when enabled is false", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: false }));

			expect(addEventListenerSpy).not.toHaveBeenCalled();
		});

		it("removes event listener on unmount", () => {
			const { unmount } = renderHook(() => usePlainTextClipboard(container));

			unmount();

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"copy",
				expect.any(Function),
				true,
			);
		});

		it("removes and re-attaches listener when container changes", () => {
			const newContainer = document.createElement("div");
			document.body.appendChild(newContainer);
			const newAddSpy = vi.spyOn(newContainer, "addEventListener");

			const { rerender } = renderHook(
				({ cont }) => usePlainTextClipboard(cont),
				{ initialProps: { cont: container } },
			);

			rerender({ cont: newContainer });

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"copy",
				expect.any(Function),
				true,
			);
			expect(newAddSpy).toHaveBeenCalledWith(
				"copy",
				expect.any(Function),
				true,
			);

			document.body.removeChild(newContainer);
		});

		it("removes listener when enabled changes to false", () => {
			const { rerender } = renderHook(
				({ enabled }) => usePlainTextClipboard(container, { enabled }),
				{ initialProps: { enabled: true } },
			);

			rerender({ enabled: false });

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"copy",
				expect.any(Function),
				true,
			);
		});
	});

	describe("copy event handling", () => {
		it("sets text/plain clipboard data with selected text", () => {
			renderHook(() => usePlainTextClipboard(container));

			const mockSelection = {
				isCollapsed: false,
				toString: () => "Hello World",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith(
				"text/plain",
				"Hello World",
			);
		});

		it("does not set clipboard data when selection is collapsed", () => {
			renderHook(() => usePlainTextClipboard(container));

			const mockSelection = {
				isCollapsed: true,
				toString: () => "",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();
		});

		it("does not set clipboard data when selection is null", () => {
			renderHook(() => usePlainTextClipboard(container));

			vi.spyOn(window, "getSelection").mockReturnValue(null);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();
		});

		it("does not set clipboard data when selected text is empty", () => {
			renderHook(() => usePlainTextClipboard(container));

			const mockSelection = {
				isCollapsed: false,
				toString: () => "",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).not.toHaveBeenCalled();
		});

		it("does nothing when clipboardData is null", () => {
			renderHook(() => usePlainTextClipboard(container));

			const mockSelection = {
				isCollapsed: false,
				toString: () => "Hello World",
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const copyEvent = createMockClipboardEvent(null);

			expect(() => container.dispatchEvent(copyEvent)).not.toThrow();
		});

		it("handles multiline text selection", () => {
			renderHook(() => usePlainTextClipboard(container));

			const multilineText = "Line 1\nLine 2\nLine 3";
			const mockSelection = {
				isCollapsed: false,
				toString: () => multilineText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith(
				"text/plain",
				multilineText,
			);
		});

		it("handles text with special characters", () => {
			renderHook(() => usePlainTextClipboard(container));

			const specialText = "Hello <World> & \"Friends\" 'Family'";
			const mockSelection = {
				isCollapsed: false,
				toString: () => specialText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith(
				"text/plain",
				specialText,
			);
		});

		it("handles unicode text", () => {
			renderHook(() => usePlainTextClipboard(container));

			const unicodeText = "Hello 世界 🌍 مرحبا";
			const mockSelection = {
				isCollapsed: false,
				toString: () => unicodeText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith(
				"text/plain",
				unicodeText,
			);
		});

		it("copies link text without markdown syntax", () => {
			renderHook(() => usePlainTextClipboard(container));

			const linkVisualText = "Click here";
			const mockSelection = {
				isCollapsed: false,
				toString: () => linkVisualText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith(
				"text/plain",
				linkVisualText,
			);
		});

		it("copies URL without angle brackets", () => {
			renderHook(() => usePlainTextClipboard(container));

			const urlText = "https://example.com/path";
			const mockSelection = {
				isCollapsed: false,
				toString: () => urlText,
			};
			vi.spyOn(window, "getSelection").mockReturnValue(
				mockSelection as unknown as Selection,
			);

			const clipboardData = { setData: vi.fn() };
			const copyEvent = createMockClipboardEvent(clipboardData);

			container.dispatchEvent(copyEvent);

			expect(clipboardData.setData).toHaveBeenCalledWith("text/plain", urlText);
		});
	});

	describe("enabled option", () => {
		it("defaults to enabled when option is not provided", () => {
			renderHook(() => usePlainTextClipboard(container));

			expect(addEventListenerSpy).toHaveBeenCalled();
		});

		it("defaults to enabled when options object is empty", () => {
			renderHook(() => usePlainTextClipboard(container, {}));

			expect(addEventListenerSpy).toHaveBeenCalled();
		});

		it("is enabled when explicitly set to true", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: true }));

			expect(addEventListenerSpy).toHaveBeenCalled();
		});

		it("is disabled when explicitly set to false", () => {
			renderHook(() => usePlainTextClipboard(container, { enabled: false }));

			expect(addEventListenerSpy).not.toHaveBeenCalled();
		});

		it("can be toggled at runtime", () => {
			const { rerender } = renderHook(
				({ enabled }) => usePlainTextClipboard(container, { enabled }),
				{ initialProps: { enabled: false } },
			);

			expect(addEventListenerSpy).not.toHaveBeenCalled();

			rerender({ enabled: true });

			expect(addEventListenerSpy).toHaveBeenCalled();
		});
	});
});
