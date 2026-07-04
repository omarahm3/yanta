import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoSave } from "../useAutoSave";

vi.mock("@/shared/stores/preferences.store", () => ({
	useMergedConfig: () => ({
		timeouts: {
			autoSaveDebounceMs: 100,
			autoSaveMaxRetries: 3,
			autoSaveRetryBaseMs: 50,
			savedStateDisplayMs: 100,
		},
	}),
}));

describe("useAutoSave lost-update race (P1.1)", () => {
	it("saves edits that arrive while a save is in flight", async () => {
		vi.useFakeTimers();

		let resolveFirstSave: (() => void) | undefined;
		const onSave = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						resolveFirstSave = resolve;
					}),
			)
			.mockResolvedValue(undefined);

		const { result, rerender } = renderHook(
			({ value }) =>
				useAutoSave({ value, onSave, delay: 100, isInitialized: true, compareKey: value }),
			{ initialProps: { value: "v0" } },
		);

		// Establish the saved baseline at "v0" (ready transition false -> true is
		// simulated by the isInitialized effect on first render with a stable value).
		rerender({ value: "v0" });

		// First edit -> debounced save starts and blocks in flight.
		rerender({ value: "v1" });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100);
		});
		expect(onSave).toHaveBeenCalledTimes(1);

		// Second edit arrives WHILE the first save is still in flight.
		rerender({ value: "v2" });

		// Complete the in-flight save (it persisted "v1").
		await act(async () => {
			resolveFirstSave?.();
			await vi.advanceTimersByTimeAsync(0);
		});

		// The follow-up save for "v2" must fire — otherwise the edit is lost.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100);
		});
		expect(onSave).toHaveBeenCalledTimes(2);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(result.current.hasUnsavedChanges).toBe(false);
	});
});
