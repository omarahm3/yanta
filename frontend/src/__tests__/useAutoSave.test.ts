import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "../hooks/useAutoSave";

describe("useAutoSave", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("Debouncing behavior", () => {
		it("should debounce rapid changes and only save once", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// Make multiple rapid changes
			rerender({ value: "change1" });
			act(() => {
				vi.advanceTimersByTime(500);
			});

			rerender({ value: "change2" });
			act(() => {
				vi.advanceTimersByTime(500);
			});

			rerender({ value: "change3" });
			act(() => {
				vi.advanceTimersByTime(500);
			});

			// Save should not have been called yet
			expect(onSave).not.toHaveBeenCalled();

			// After full delay from last change
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Should only save once with the final value
			await vi.runOnlyPendingTimersAsync();
			expect(onSave).toHaveBeenCalledTimes(1);
		});

		it("should not start new save while already saving", async () => {
			let saveResolver: (() => void) | null = null;
			const onSave = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						saveResolver = resolve;
					}),
			);

			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// Trigger first save
			rerender({ value: "change1" });
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			expect(result.current.saveState).toBe("saving");
			expect(onSave).toHaveBeenCalledTimes(1);

			// Try to trigger another save while first is in progress
			rerender({ value: "change2" });
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Should not call save again because first save is still in progress
			expect(onSave).toHaveBeenCalledTimes(1);

			// Complete the first save
			await act(async () => {
				saveResolver?.();
			});

			// Wait for promise resolution and state update
			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.saveState).toBe("saved");
		});

		it("should reset debounce timer on each change", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// First change
			rerender({ value: "change1" });
			act(() => {
				vi.advanceTimersByTime(1500);
			});

			// Second change before timer expires - should reset timer
			rerender({ value: "change2" });
			act(() => {
				vi.advanceTimersByTime(1500);
			});

			// Should not have saved yet (only 1500ms since last change)
			expect(onSave).not.toHaveBeenCalled();

			// Wait for remaining time
			await act(async () => {
				vi.advanceTimersByTime(500);
			});

			// Now it should save
			await vi.runOnlyPendingTimersAsync();
			expect(onSave).toHaveBeenCalledTimes(1);
		});
	});

	describe("Save state tracking", () => {
		it("should track unsaved changes correctly", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			expect(result.current.hasUnsavedChanges).toBe(false);

			// Make a change
			rerender({ value: "changed" });

			expect(result.current.hasUnsavedChanges).toBe(true);

			// Wait for save
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			await vi.runOnlyPendingTimersAsync();
			expect(result.current.hasUnsavedChanges).toBe(false);
		});

		it("should transition through save states correctly", async () => {
			const onSave = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
			});

			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			expect(result.current.saveState).toBe("idle");

			// Make a change and trigger save
			rerender({ value: "changed" });
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Should be saving
			expect(result.current.saveState).toBe("saving");

			// Complete the save
			await act(async () => {
				vi.advanceTimersByTime(100);
			});

			// Wait for promise resolution and state update
			await act(async () => {
				await Promise.resolve();
			});

			expect(result.current.saveState).toBe("saved");

			// Should return to idle after 3 seconds
			await act(async () => {
				vi.advanceTimersByTime(3000);
			});

			expect(result.current.saveState).toBe("idle");
		});
	});

	describe("Immediate save", () => {
		it("should save immediately when saveNow is called", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// Make a change
			rerender({ value: "changed" });

			// Don't wait for debounce, call saveNow immediately
			await act(async () => {
				await result.current.saveNow();
			});

			// Should have saved immediately
			expect(onSave).toHaveBeenCalledTimes(1);
		});

		it("should cancel pending debounced save when saveNow is called", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// Make a change (starts debounce timer)
			rerender({ value: "changed" });

			// Wait a bit but not full delay
			act(() => {
				vi.advanceTimersByTime(1000);
			});

			// Call saveNow (should cancel debounce and save immediately)
			await act(async () => {
				await result.current.saveNow();
			});

			expect(onSave).toHaveBeenCalledTimes(1);

			// Advance past original debounce delay
			act(() => {
				vi.advanceTimersByTime(2000);
			});

			// Should still only have been called once
			expect(onSave).toHaveBeenCalledTimes(1);
		});
	});

	describe("Disabled state", () => {
		it("should not save when disabled", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender } = renderHook(
				({ value, enabled }) => useAutoSave({ value, onSave, delay: 2000, enabled }),
				{ initialProps: { value: "initial", enabled: false } },
			);

			// Make a change while disabled
			rerender({ value: "changed", enabled: false });

			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Should not have saved
			expect(onSave).not.toHaveBeenCalled();
		});

		it("should resume saving when re-enabled", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender } = renderHook(
				({ value, enabled }) => useAutoSave({ value, onSave, delay: 2000, enabled }),
				{ initialProps: { value: "initial", enabled: false } },
			);

			// Make a change while disabled
			rerender({ value: "changed", enabled: false });

			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			expect(onSave).not.toHaveBeenCalled();

			// Re-enable
			rerender({ value: "changed", enabled: true });

			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Should have saved now
			await vi.runOnlyPendingTimersAsync();
			expect(onSave).toHaveBeenCalledTimes(1);
		});
	});

	describe("Error handling", () => {
		it("should handle save errors with retry", async () => {
			let callCount = 0;
			const onSave = vi.fn(async () => {
				callCount++;
				if (callCount < 3) {
					throw new Error("Save failed");
				}
			});

			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// Trigger save
			rerender({ value: "changed" });
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Should have attempted once and failed
			expect(onSave).toHaveBeenCalledTimes(1);
			expect(result.current.saveState).toBe("saving");

			// Wait for first retry (1 second)
			await act(async () => {
				vi.advanceTimersByTime(1000);
			});

			expect(onSave).toHaveBeenCalledTimes(2);

			// Wait for second retry (2 seconds)
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Wait for promise resolution and state update
			await act(async () => {
				await Promise.resolve();
			});

			// Should succeed on third attempt
			expect(onSave).toHaveBeenCalledTimes(3);
			expect(result.current.saveState).toBe("saved");
		});

		it("should give up after max retries", async () => {
			const onSave = vi.fn(async () => {
				throw new Error("Save failed");
			});

			const { result, rerender } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// Trigger save
			rerender({ value: "changed" });
			await act(async () => {
				vi.advanceTimersByTime(2000);
			});

			// Initial attempt + 3 retries = 4 total attempts
			for (let i = 0; i < 3; i++) {
				await act(async () => {
					vi.advanceTimersByTime(2 ** i * 1000);
				});
			}

			await vi.runOnlyPendingTimersAsync();
			expect(onSave).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
			expect(result.current.saveState).toBe("error");
			expect(result.current.saveError).toEqual(new Error("Save failed"));
		});
	});

	describe("Cleanup", () => {
		it("should cancel pending save on unmount", async () => {
			const onSave = vi.fn(async () => {});
			const { result, rerender, unmount } = renderHook(
				({ value }) => useAutoSave({ value, onSave, delay: 2000, enabled: true }),
				{ initialProps: { value: "initial" } },
			);

			// Make a change
			rerender({ value: "changed" });

			// Advance timer partially
			act(() => {
				vi.advanceTimersByTime(1000);
			});

			// Unmount before save happens
			unmount();

			// Advance past original delay
			act(() => {
				vi.advanceTimersByTime(2000);
			});

			// Should not have saved
			expect(onSave).not.toHaveBeenCalled();
		});
	});
});
