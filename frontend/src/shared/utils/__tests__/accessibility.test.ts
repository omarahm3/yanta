import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetLiveRegion, announceForScreenReaders } from "../accessibility";

describe("announceForScreenReaders", () => {
	beforeEach(() => {
		// Reset the internal state before each test
		_resetLiveRegion();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		_resetLiveRegion();
	});

	it("creates an aria-live region in the document", () => {
		announceForScreenReaders("Test message");

		const liveRegion = document.querySelector('[role="status"][aria-live]');
		expect(liveRegion).not.toBeNull();
		expect(liveRegion?.getAttribute("aria-live")).toBe("polite");
		expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");
	});

	it("sets the message content after requestAnimationFrame", async () => {
		announceForScreenReaders("Test message");

		// Wait for requestAnimationFrame to execute
		await new Promise((resolve) => requestAnimationFrame(resolve));

		const liveRegion = document.querySelector('[role="status"][aria-live]');
		expect(liveRegion?.textContent).toBe("Test message");
	});

	it("uses polite politeness by default", () => {
		announceForScreenReaders("Test message");

		const liveRegion = document.querySelector('[role="status"][aria-live]');
		expect(liveRegion?.getAttribute("aria-live")).toBe("polite");
	});

	it("uses assertive politeness when specified", () => {
		announceForScreenReaders("Urgent message", "assertive");

		const liveRegion = document.querySelector('[role="status"][aria-live]');
		expect(liveRegion?.getAttribute("aria-live")).toBe("assertive");
	});

	it("applies visually hidden styles", () => {
		announceForScreenReaders("Test message");

		const liveRegion = document.querySelector('[role="status"][aria-live]') as HTMLElement;
		expect(liveRegion).not.toBeNull();
		expect(liveRegion.style.position).toBe("absolute");
		expect(liveRegion.style.width).toBe("1px");
		expect(liveRegion.style.height).toBe("1px");
		expect(liveRegion.style.overflow).toBe("hidden");
	});

	it("reuses the same live region for multiple announcements", () => {
		announceForScreenReaders("First message");
		announceForScreenReaders("Second message");

		const liveRegions = document.querySelectorAll('[role="status"][aria-live]');
		expect(liveRegions.length).toBe(1);
	});

	it("clears the message after timeout", async () => {
		vi.useFakeTimers();
		announceForScreenReaders("Test message");

		// Advance past requestAnimationFrame and setTimeout
		await vi.advanceTimersByTimeAsync(100); // for rAF
		await vi.advanceTimersByTimeAsync(1100); // for setTimeout

		const liveRegion = document.querySelector('[role="status"][aria-live]');
		expect(liveRegion?.textContent).toBe("");

		vi.useRealTimers();
	});
});
