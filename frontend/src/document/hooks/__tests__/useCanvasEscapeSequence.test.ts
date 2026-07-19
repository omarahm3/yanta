import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasEscapeSequence } from "../useCanvasEscapeSequence";

function escapeEvent() {
	const e = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
	vi.spyOn(e, "preventDefault");
	vi.spyOn(e, "stopPropagation");
	vi.spyOn(e, "stopImmediatePropagation");
	return e;
}

describe("useCanvasEscapeSequence", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	const setup = (isActive = true) => {
		const onUnfocus = vi.fn();
		const onExit = vi.fn();
		const isActivePaneRef = { current: isActive };
		const { result } = renderHook(() =>
			useCanvasEscapeSequence({ isActivePaneRef, isCanvas: true, onUnfocus, onExit }),
		);
		return { handle: result.current, onUnfocus, onExit, isActivePaneRef };
	};

	it("yields the 1st Escape to Excalidraw (no consume, no callbacks)", () => {
		const { handle, onUnfocus, onExit } = setup();
		const e = escapeEvent();
		handle(e);
		expect(e.preventDefault).not.toHaveBeenCalled();
		expect(e.stopImmediatePropagation).not.toHaveBeenCalled();
		expect(onUnfocus).not.toHaveBeenCalled();
		expect(onExit).not.toHaveBeenCalled();
	});

	it("unfocuses on the 2nd Escape and consumes the event", () => {
		const { handle, onUnfocus, onExit } = setup();
		handle(escapeEvent());
		const e = escapeEvent();
		handle(e);
		expect(e.preventDefault).toHaveBeenCalled();
		expect(e.stopImmediatePropagation).toHaveBeenCalled();
		expect(onUnfocus).toHaveBeenCalledTimes(1);
		expect(onExit).not.toHaveBeenCalled();
	});

	it("exits on the 3rd Escape", () => {
		const { handle, onUnfocus, onExit } = setup();
		handle(escapeEvent());
		handle(escapeEvent());
		handle(escapeEvent());
		expect(onUnfocus).toHaveBeenCalledTimes(1);
		expect(onExit).toHaveBeenCalledTimes(1);
	});

	it("does nothing when the pane is not active", () => {
		const { handle, onUnfocus, onExit } = setup(false);
		handle(escapeEvent());
		handle(escapeEvent());
		handle(escapeEvent());
		expect(onUnfocus).not.toHaveBeenCalled();
		expect(onExit).not.toHaveBeenCalled();
	});

	it("restarts the sequence after the reset window elapses", () => {
		const { handle, onUnfocus } = setup();
		handle(escapeEvent()); // count = 1
		vi.advanceTimersByTime(1001); // window elapses -> reset to 0
		handle(escapeEvent()); // count = 1 again, not 2
		expect(onUnfocus).not.toHaveBeenCalled();
	});

	it("restarts the sequence when another key is pressed on the canvas", () => {
		const { handle, onUnfocus } = setup();
		handle(escapeEvent()); // count = 1
		// A non-Escape keydown reaches the window listener and resets.
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
		handle(escapeEvent()); // count = 1 again
		expect(onUnfocus).not.toHaveBeenCalled();
	});

	it("restarts the sequence on a pointer press", () => {
		const { handle, onUnfocus } = setup();
		handle(escapeEvent()); // count = 1
		window.dispatchEvent(new Event("pointerdown"));
		handle(escapeEvent()); // count = 1 again
		expect(onUnfocus).not.toHaveBeenCalled();
	});

	it("removes its window listeners on unmount", () => {
		const remove = vi.spyOn(window, "removeEventListener");
		const onUnfocus = vi.fn();
		const onExit = vi.fn();
		const { unmount } = renderHook(() =>
			useCanvasEscapeSequence({
				isActivePaneRef: { current: true },
				isCanvas: true,
				onUnfocus,
				onExit,
			}),
		);
		unmount();
		expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function), true);
		expect(remove).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
	});
});
