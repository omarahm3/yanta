import { useCallback, useEffect, useRef } from "react";

interface UseCanvasEscapeSequenceOptions {
	/** Ref whose .current is true while this pane is the active one. */
	isActivePaneRef: { current: boolean };
	/** True only for canvas documents; the reset listeners mount only then. */
	isCanvas: boolean;
	/** Called on the 2nd consecutive Escape — drop keyboard focus from the canvas. */
	onUnfocus: () => void;
	/** Called on the 3rd consecutive Escape — leave the canvas. */
	onExit: () => void;
}

// A consecutive Escape must land within this window of the previous one to count
// toward the gesture; otherwise the sequence restarts from the first tap.
const RESET_MS = 1000;

/**
 * Layered Escape for a canvas, so it respects Excalidraw's own Escape while still
 * offering a keyboard way out:
 *   1st Escape → yielded to Excalidraw (deselect / exit tool / finish text / close menu)
 *   2nd Escape → unfocus the canvas
 *   3rd Escape → navigate back
 * Only the 2nd and 3rd taps are consumed, so the 1st always reaches Excalidraw.
 * The sequence restarts after {@link RESET_MS} of no Escape, or as soon as the user
 * does anything else on the canvas (any non-Escape key or a pointer press) — a
 * deliberate triple-tap is required, not three unrelated Escapes.
 */
export function useCanvasEscapeSequence({
	isActivePaneRef,
	isCanvas,
	onUnfocus,
	onExit,
}: UseCanvasEscapeSequenceOptions): (e: KeyboardEvent) => void {
	const countRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onUnfocusRef = useRef(onUnfocus);
	const onExitRef = useRef(onExit);
	onUnfocusRef.current = onUnfocus;
	onExitRef.current = onExit;

	const reset = useCallback(() => {
		countRef.current = 0;
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const handleCanvasEscape = useCallback(
		(e: KeyboardEvent) => {
			if (!isActivePaneRef.current) return;

			countRef.current += 1;
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(reset, RESET_MS);

			if (countRef.current === 1) return;

			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			if (countRef.current === 2) {
				onUnfocusRef.current();
				return;
			}

			reset();
			onExitRef.current();
		},
		[isActivePaneRef, reset],
	);

	useEffect(() => {
		if (!isCanvas) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") reset();
		};
		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("pointerdown", reset, true);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("pointerdown", reset, true);
			reset();
		};
	}, [isCanvas, reset]);

	return handleCanvasEscape;
}
