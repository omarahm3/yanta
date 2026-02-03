import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboarding } from "../useOnboarding";

describe("useOnboarding", () => {
	const STORAGE_KEY = "yanta_onboarding";

	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("initializes with null state when localStorage is empty", () => {
			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toBeNull();
		});

		it("loads existing data from localStorage", () => {
			const existingData = {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toEqual(existingData);
		});

		it("handles invalid JSON in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, "invalid-json");

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toBeNull();
		});

		it("handles malformed data structure in localStorage gracefully", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toBeNull();
		});

		it("handles missing required fields gracefully", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toBeNull();
		});

		it("handles invalid completedWelcome type gracefully", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedWelcome: "yes", version: "1.0.0" }));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toBeNull();
		});

		it("handles invalid version type gracefully", () => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedWelcome: true, version: 123 }));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toBeNull();
		});

		it("handles invalid completedAt type gracefully", () => {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					completedWelcome: true,
					version: "1.0.0",
					completedAt: "not-a-number",
				}),
			);

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toBeNull();
		});

		it("accepts valid data without completedAt", () => {
			const existingData = {
				completedWelcome: false,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.onboardingData).toEqual(existingData);
		});
	});

	describe("hasCompletedOnboarding", () => {
		it("returns false when no onboarding data exists", () => {
			const { result } = renderHook(() => useOnboarding());

			expect(result.current.hasCompletedOnboarding()).toBe(false);
		});

		it("returns false when completedWelcome is false", () => {
			const existingData = {
				completedWelcome: false,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.hasCompletedOnboarding()).toBe(false);
		});

		it("returns true when completedWelcome is true", () => {
			const existingData = {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.hasCompletedOnboarding()).toBe(true);
		});
	});

	describe("completeOnboarding", () => {
		it("marks onboarding as complete", () => {
			const { result } = renderHook(() => useOnboarding());

			expect(result.current.hasCompletedOnboarding()).toBe(false);

			act(() => {
				result.current.completeOnboarding();
			});

			expect(result.current.hasCompletedOnboarding()).toBe(true);
		});

		it("sets completedAt timestamp", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				result.current.completeOnboarding();
			});

			expect(result.current.onboardingData?.completedAt).toBe(5000);
		});

		it("sets version field", () => {
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				result.current.completeOnboarding();
			});

			expect(result.current.onboardingData?.version).toBe("1.0.0");
		});

		it("persists to localStorage", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				result.current.completeOnboarding();
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored).toEqual({
				completedWelcome: true,
				completedAt: 5000,
				version: "1.0.0",
			});
		});
	});

	describe("resetOnboarding", () => {
		it("clears onboarding data from state", () => {
			const existingData = {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.hasCompletedOnboarding()).toBe(true);

			act(() => {
				result.current.resetOnboarding();
			});

			expect(result.current.hasCompletedOnboarding()).toBe(false);
			expect(result.current.onboardingData).toBeNull();
		});

		it("removes data from localStorage", () => {
			const existingData = {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			act(() => {
				result.current.resetOnboarding();
			});

			expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		});
	});

	describe("storage event handling", () => {
		it("updates state when storage changes from another tab", () => {
			const { result } = renderHook(() => useOnboarding());

			const newData = {
				completedWelcome: true,
				completedAt: 9999,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));

			// Simulate storage event from another tab
			act(() => {
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: STORAGE_KEY,
						newValue: JSON.stringify(newData),
					}),
				);
			});

			expect(result.current.onboardingData).toEqual(newData);
		});

		it("ignores storage events for other keys", () => {
			const existingData = {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			// Simulate storage event for a different key
			act(() => {
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: "other_key",
						newValue: "something",
					}),
				);
			});

			// State should remain unchanged
			expect(result.current.onboardingData).toEqual(existingData);
		});
	});

	describe("full onboarding flow integration", () => {
		it("completes a full onboarding cycle", () => {
			vi.setSystemTime(new Date(1000));

			// Start with no onboarding data
			const { result } = renderHook(() => useOnboarding());
			expect(result.current.hasCompletedOnboarding()).toBe(false);

			// Complete onboarding
			act(() => {
				result.current.completeOnboarding();
			});
			expect(result.current.hasCompletedOnboarding()).toBe(true);
			expect(result.current.onboardingData?.completedAt).toBe(1000);

			// Reset onboarding
			act(() => {
				result.current.resetOnboarding();
			});
			expect(result.current.hasCompletedOnboarding()).toBe(false);

			// Complete onboarding again at a different time
			vi.setSystemTime(new Date(2000));
			act(() => {
				result.current.completeOnboarding();
			});
			expect(result.current.hasCompletedOnboarding()).toBe(true);
			expect(result.current.onboardingData?.completedAt).toBe(2000);
		});
	});

	describe("startup welcome overlay trigger", () => {
		it("does not show welcome immediately on mount", () => {
			const { result } = renderHook(() => useOnboarding());

			expect(result.current.shouldShowWelcome).toBe(false);
		});

		it("shows welcome after 500ms delay when onboarding not complete", () => {
			const { result } = renderHook(() => useOnboarding());

			expect(result.current.shouldShowWelcome).toBe(false);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(result.current.shouldShowWelcome).toBe(true);
		});

		it("does not show welcome if onboarding was already completed", () => {
			const existingData = {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			const { result } = renderHook(() => useOnboarding());

			expect(result.current.shouldShowWelcome).toBe(false);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(result.current.shouldShowWelcome).toBe(false);
		});

		it("does not show welcome before 500ms delay", () => {
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				vi.advanceTimersByTime(499);
			});

			expect(result.current.shouldShowWelcome).toBe(false);
		});

		it("cleans up timer on unmount", () => {
			const { result, unmount } = renderHook(() => useOnboarding());

			expect(result.current.shouldShowWelcome).toBe(false);

			unmount();

			act(() => {
				vi.advanceTimersByTime(500);
			});

			// Should not throw or cause issues after unmount
		});
	});

	describe("dismissWelcome", () => {
		it("hides the welcome overlay", () => {
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(result.current.shouldShowWelcome).toBe(true);

			act(() => {
				result.current.dismissWelcome();
			});

			expect(result.current.shouldShowWelcome).toBe(false);
		});

		it("marks onboarding as complete when dismissed", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(result.current.hasCompletedOnboarding()).toBe(false);

			act(() => {
				result.current.dismissWelcome();
			});

			expect(result.current.hasCompletedOnboarding()).toBe(true);
			// Time has advanced by 500ms (from 5000 to 5500)
			expect(result.current.onboardingData?.completedAt).toBe(5500);
		});

		it("persists completion to localStorage when dismissed", () => {
			vi.setSystemTime(new Date(5000));
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				vi.advanceTimersByTime(500);
			});

			act(() => {
				result.current.dismissWelcome();
			});

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			// Time has advanced by 500ms (from 5000 to 5500)
			expect(stored).toEqual({
				completedWelcome: true,
				completedAt: 5500,
				version: "1.0.0",
			});
		});
	});

	describe("resetOnboarding with welcome state", () => {
		it("resets shouldShowWelcome to false", () => {
			const { result } = renderHook(() => useOnboarding());

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(result.current.shouldShowWelcome).toBe(true);

			act(() => {
				result.current.resetOnboarding();
			});

			expect(result.current.shouldShowWelcome).toBe(false);
		});
	});
});
