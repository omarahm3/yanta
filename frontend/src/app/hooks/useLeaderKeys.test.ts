import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLeaderKeys } from "./useLeaderKeys";

function press(key: string, init: KeyboardEventInit = {}) {
	window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

describe("useLeaderKeys", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("navigates with g→d to documents", () => {
		const onNavigate = vi.fn();
		renderHook(() => useLeaderKeys({ onNavigate }));
		press("g");
		press("d");
		expect(onNavigate).toHaveBeenCalledWith("dashboard");
	});

	it("maps each leader destination", () => {
		const onNavigate = vi.fn();
		renderHook(() => useLeaderKeys({ onNavigate }));

		press("g");
		press("j");
		expect(onNavigate).toHaveBeenLastCalledWith("journal");
		press("g");
		press("s");
		expect(onNavigate).toHaveBeenLastCalledWith("search");
		press("g");
		press("p");
		expect(onNavigate).toHaveBeenLastCalledWith("projects");
		press("g");
		press(",");
		expect(onNavigate).toHaveBeenLastCalledWith("settings");
	});

	it("does nothing for an unmapped second key", () => {
		const onNavigate = vi.fn();
		renderHook(() => useLeaderKeys({ onNavigate }));
		press("g");
		press("x");
		expect(onNavigate).not.toHaveBeenCalled();
	});

	it("does not treat a bare destination key as navigation", () => {
		const onNavigate = vi.fn();
		renderHook(() => useLeaderKeys({ onNavigate }));
		press("d");
		expect(onNavigate).not.toHaveBeenCalled();
	});

	it("ignores the leader sequence while typing in a field", () => {
		const onNavigate = vi.fn();
		renderHook(() => useLeaderKeys({ onNavigate }));
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
		expect(onNavigate).not.toHaveBeenCalled();
		input.remove();
	});

	it("disarms when a modifier is held with the leader", () => {
		const onNavigate = vi.fn();
		renderHook(() => useLeaderKeys({ onNavigate }));
		press("g", { ctrlKey: true });
		press("d");
		expect(onNavigate).not.toHaveBeenCalled();
	});
});
