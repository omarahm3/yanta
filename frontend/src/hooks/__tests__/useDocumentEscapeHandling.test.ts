import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDocumentEscapeHandling } from "../useDocumentEscapeHandling";

function createMockEditor(focused: boolean) {
	const blurFn = vi.fn();
	return {
		editor: {
			isFocused: () => focused,
			domElement: { blur: blurFn },
		},
		blurFn,
	};
}

describe("useDocumentEscapeHandling", () => {
	it("blurs focused editor on escape (does not navigate back)", () => {
		const { editor, blurFn } = createMockEditor(true);
		const editorRef = { current: editor as any };
		const onNavigateBack = vi.fn();

		const { result } = renderHook(() =>
			useDocumentEscapeHandling({ editorRef, onNavigateBack }),
		);

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		result.current.handleEscape(event);

		expect(blurFn).toHaveBeenCalled();
		expect(onNavigateBack).not.toHaveBeenCalled();
	});

	it("navigates back when editor is not focused", () => {
		const { editor } = createMockEditor(false);
		const editorRef = { current: editor as any };
		const onNavigateBack = vi.fn();

		const { result } = renderHook(() =>
			useDocumentEscapeHandling({ editorRef, onNavigateBack }),
		);

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		result.current.handleEscape(event);

		expect(onNavigateBack).toHaveBeenCalled();
	});

	it("does not navigate back when isActivePane is false", () => {
		const { editor } = createMockEditor(false);
		const editorRef = { current: editor as any };
		const onNavigateBack = vi.fn();

		const { result } = renderHook(() =>
			useDocumentEscapeHandling({ editorRef, onNavigateBack, isActivePane: false }),
		);

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		result.current.handleEscape(event);

		expect(onNavigateBack).not.toHaveBeenCalled();
	});

	it("still blurs editor when isActivePane is false and editor is focused", () => {
		const { editor, blurFn } = createMockEditor(true);
		const editorRef = { current: editor as any };
		const onNavigateBack = vi.fn();

		const { result } = renderHook(() =>
			useDocumentEscapeHandling({ editorRef, onNavigateBack, isActivePane: false }),
		);

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		result.current.handleEscape(event);

		expect(blurFn).toHaveBeenCalled();
		expect(onNavigateBack).not.toHaveBeenCalled();
	});

	it("handleUnfocus blurs editor without navigating back", () => {
		const { editor, blurFn } = createMockEditor(true);
		const editorRef = { current: editor as any };
		const onNavigateBack = vi.fn();

		const { result } = renderHook(() =>
			useDocumentEscapeHandling({ editorRef, onNavigateBack }),
		);

		const event = new KeyboardEvent("keydown", { key: "c", ctrlKey: true });
		result.current.handleUnfocus(event);

		expect(blurFn).toHaveBeenCalled();
		expect(onNavigateBack).not.toHaveBeenCalled();
	});

	it("does nothing when editor ref is null", () => {
		const editorRef = { current: null };
		const onNavigateBack = vi.fn();

		const { result } = renderHook(() =>
			useDocumentEscapeHandling({ editorRef, onNavigateBack }),
		);

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		result.current.handleEscape(event);

		expect(onNavigateBack).not.toHaveBeenCalled();
	});
});
