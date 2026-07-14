import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLifoEscape } from "../shared/hooks/useLifoEscape";
import { dispatchEscape, useEscapeRegistryStore } from "../shared/stores/escapeRegistry.store";

describe("LIFO escape registry", () => {
	beforeEach(() => {
		useEscapeRegistryStore.getState().reset();
	});

	afterEach(() => {
		useEscapeRegistryStore.getState().reset();
	});

	it("calls only the topmost handler", () => {
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		renderHook(() => useLifoEscape({ when: true, onEscape: handler1 }));
		renderHook(() => useLifoEscape({ when: true, onEscape: handler2 }));

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		dispatchEscape(event);

		expect(handler2).toHaveBeenCalledTimes(1);
		expect(handler1).not.toHaveBeenCalled();
	});

	it("falls back to the next handler when the topmost unregisters", () => {
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		// handler2 is registered last (topmost); unmounting it must fall back to
		// handler1, which is now the top of the stack.
		renderHook(() => useLifoEscape({ when: true, onEscape: handler1 }));
		const { unmount } = renderHook(() => useLifoEscape({ when: true, onEscape: handler2 }));

		unmount();

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		dispatchEscape(event);

		expect(handler1).toHaveBeenCalledTimes(1);
		expect(handler2).not.toHaveBeenCalled();
	});

	it("reports handled status from the topmost handler", () => {
		renderHook(() => useLifoEscape({ when: true, onEscape: () => false }));
		const declined = dispatchEscape(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(declined).toBe(false);

		useEscapeRegistryStore.getState().reset();

		renderHook(() => useLifoEscape({ when: true, onEscape: () => true }));
		const handled = dispatchEscape(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(handled).toBe(true);
	});

	it("does not call handlers when stack is empty", () => {
		const event = new KeyboardEvent("keydown", { key: "Escape" });
		const result = dispatchEscape(event);
		expect(result).toBe(false);
	});

	it("respects the when flag", () => {
		const handler = vi.fn();

		renderHook(() => useLifoEscape({ when: false, onEscape: handler }));

		const event = new KeyboardEvent("keydown", { key: "Escape" });
		dispatchEscape(event);

		expect(handler).not.toHaveBeenCalled();
	});
});
