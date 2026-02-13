import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShortcutTooltip } from "../useShortcutTooltip";

// Mock the useTooltipUsage hook
const mockShouldShowTooltip = vi.fn();
const mockRecordTooltipView = vi.fn();
const mockGetTooltipUsage = vi.fn();
const mockGetAllTooltipUsage = vi.fn();

vi.mock("../../stores/tooltipUsage.store", () => ({
	useTooltipUsage: () => ({
		shouldShowTooltip: mockShouldShowTooltip,
		recordTooltipView: mockRecordTooltipView,
		getTooltipUsage: mockGetTooltipUsage,
		getAllTooltipUsage: mockGetAllTooltipUsage,
	}),
}));

describe("useShortcutTooltip", () => {
	const HOVER_DELAY = 500;
	const FOCUS_DELAY = 800;

	beforeEach(() => {
		vi.useFakeTimers();
		mockShouldShowTooltip.mockReturnValue(true);
		mockRecordTooltipView.mockClear();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("returns tooltipProps with correct initial values", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
					shortcut: "Ctrl+S",
				}),
			);

			expect(result.current.tooltipProps).toMatchObject({
				isVisible: false,
				description: "Test description",
				shortcut: "Ctrl+S",
				placement: "top",
				shouldRender: true,
			});
			expect(result.current.tooltipProps.id).toMatch(/^tooltip-/);
		});

		it("returns triggerProps with event handlers", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			expect(result.current.triggerProps.onMouseEnter).toBeInstanceOf(Function);
			expect(result.current.triggerProps.onMouseLeave).toBeInstanceOf(Function);
			expect(result.current.triggerProps.onFocus).toBeInstanceOf(Function);
			expect(result.current.triggerProps.onBlur).toBeInstanceOf(Function);
		});

		it("returns show and hide functions", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			expect(result.current.show).toBeInstanceOf(Function);
			expect(result.current.hide).toBeInstanceOf(Function);
		});

		it("uses default placement when not specified", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			expect(result.current.tooltipProps.placement).toBe("top");
		});

		it("uses custom placement when specified", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
					placement: "bottom",
				}),
			);

			expect(result.current.tooltipProps.placement).toBe("bottom");
		});

		it("does not include aria-describedby when tooltip is hidden", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			expect(result.current.triggerProps["aria-describedby"]).toBeUndefined();
		});
	});

	describe("show/hide behavior", () => {
		it("shows tooltip after calling onMouseEnter and waiting for hover delay", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			act(() => {
				result.current.triggerProps.onMouseEnter();
			});

			// Not visible immediately
			expect(result.current.tooltipProps.isVisible).toBe(false);

			// Advance by less than hover delay
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY - 100);
			});
			expect(result.current.tooltipProps.isVisible).toBe(false);

			// Advance to full hover delay
			act(() => {
				vi.advanceTimersByTime(100);
			});
			expect(result.current.tooltipProps.isVisible).toBe(true);
		});

		it("shows tooltip after calling onFocus and waiting for focus delay", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			act(() => {
				result.current.triggerProps.onFocus();
			});

			// Not visible immediately
			expect(result.current.tooltipProps.isVisible).toBe(false);

			// Advance by less than focus delay
			act(() => {
				vi.advanceTimersByTime(FOCUS_DELAY - 100);
			});
			expect(result.current.tooltipProps.isVisible).toBe(false);

			// Advance to full focus delay
			act(() => {
				vi.advanceTimersByTime(100);
			});
			expect(result.current.tooltipProps.isVisible).toBe(true);
		});

		it("hides tooltip immediately on onMouseLeave", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			// Show tooltip
			act(() => {
				result.current.triggerProps.onMouseEnter();
			});
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});
			expect(result.current.tooltipProps.isVisible).toBe(true);

			// Hide tooltip
			act(() => {
				result.current.triggerProps.onMouseLeave();
			});
			expect(result.current.tooltipProps.isVisible).toBe(false);
		});

		it("hides tooltip immediately on onBlur", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			// Show tooltip
			act(() => {
				result.current.triggerProps.onFocus();
			});
			act(() => {
				vi.advanceTimersByTime(FOCUS_DELAY);
			});
			expect(result.current.tooltipProps.isVisible).toBe(true);

			// Hide tooltip
			act(() => {
				result.current.triggerProps.onBlur();
			});
			expect(result.current.tooltipProps.isVisible).toBe(false);
		});

		it("cancels show timeout when onMouseLeave is called before delay", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			act(() => {
				result.current.triggerProps.onMouseEnter();
			});
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY - 100);
			});
			act(() => {
				result.current.triggerProps.onMouseLeave();
			});

			// Advance past the original delay
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(result.current.tooltipProps.isVisible).toBe(false);
		});

		it("show() makes tooltip visible immediately", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			act(() => {
				result.current.show();
			});

			expect(result.current.tooltipProps.isVisible).toBe(true);
		});

		it("hide() makes tooltip hidden and cancels pending show", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			// Start showing
			act(() => {
				result.current.triggerProps.onMouseEnter();
			});
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY - 100);
			});

			// Hide before delay completes
			act(() => {
				result.current.hide();
			});

			// Advance past original delay
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(result.current.tooltipProps.isVisible).toBe(false);
		});
	});

	describe("aria-describedby", () => {
		it("sets aria-describedby when tooltip is visible", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			// Show tooltip
			act(() => {
				result.current.show();
			});

			expect(result.current.triggerProps["aria-describedby"]).toBe(result.current.tooltipProps.id);
		});

		it("removes aria-describedby when tooltip is hidden", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			// Show then hide
			act(() => {
				result.current.show();
			});
			expect(result.current.triggerProps["aria-describedby"]).toBeTruthy();

			act(() => {
				result.current.hide();
			});
			expect(result.current.triggerProps["aria-describedby"]).toBeUndefined();
		});
	});

	describe("useTooltipUsage integration", () => {
		it("does not show tooltip when shouldShowTooltip returns false", () => {
			mockShouldShowTooltip.mockReturnValue(false);

			const { result } = renderHook(() =>
				useShortcutTooltip("faded-tooltip", {
					description: "Test description",
				}),
			);

			act(() => {
				result.current.triggerProps.onMouseEnter();
			});
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(result.current.tooltipProps.isVisible).toBe(false);
		});

		it("returns shouldRender=false when shouldShowTooltip returns false", () => {
			mockShouldShowTooltip.mockReturnValue(false);

			const { result } = renderHook(() =>
				useShortcutTooltip("faded-tooltip", {
					description: "Test description",
				}),
			);

			expect(result.current.tooltipProps.shouldRender).toBe(false);
		});

		it("calls recordTooltipView when tooltip becomes visible", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			act(() => {
				result.current.show();
			});

			expect(mockRecordTooltipView).toHaveBeenCalledWith("test-tooltip");
		});

		it("only calls recordTooltipView once per session", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			// First show
			act(() => {
				result.current.show();
			});
			expect(mockRecordTooltipView).toHaveBeenCalledTimes(1);

			// Hide and show again
			act(() => {
				result.current.hide();
			});
			act(() => {
				result.current.show();
			});

			// Should still only be called once
			expect(mockRecordTooltipView).toHaveBeenCalledTimes(1);
		});

		it("checks shouldShowTooltip with correct tooltipId", () => {
			renderHook(() =>
				useShortcutTooltip("specific-tooltip-id", {
					description: "Test description",
				}),
			);

			expect(mockShouldShowTooltip).toHaveBeenCalledWith("specific-tooltip-id");
		});
	});

	describe("disabled prop", () => {
		it("does not show tooltip when disabled", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
					disabled: true,
				}),
			);

			act(() => {
				result.current.triggerProps.onMouseEnter();
			});
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(result.current.tooltipProps.isVisible).toBe(false);
		});

		it("returns shouldRender=false when disabled", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
					disabled: true,
				}),
			);

			expect(result.current.tooltipProps.shouldRender).toBe(false);
		});

		it("does not call recordTooltipView when disabled", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
					disabled: true,
				}),
			);

			act(() => {
				result.current.show();
			});

			expect(mockRecordTooltipView).not.toHaveBeenCalled();
		});

		it("show() does nothing when disabled", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
					disabled: true,
				}),
			);

			act(() => {
				result.current.show();
			});

			expect(result.current.tooltipProps.isVisible).toBe(false);
		});
	});

	describe("config options", () => {
		it("passes description to tooltipProps", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Save your document",
				}),
			);

			expect(result.current.tooltipProps.description).toBe("Save your document");
		});

		it("passes shortcut to tooltipProps", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Save",
					shortcut: "Ctrl+S",
				}),
			);

			expect(result.current.tooltipProps.shortcut).toBe("Ctrl+S");
		});

		it("shortcut is undefined when not provided", () => {
			const { result } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Save",
				}),
			);

			expect(result.current.tooltipProps.shortcut).toBeUndefined();
		});

		it("accepts all placement options", () => {
			const placements = ["top", "bottom", "left", "right"] as const;

			for (const placement of placements) {
				const { result } = renderHook(() =>
					useShortcutTooltip("test-tooltip", {
						description: "Test",
						placement,
					}),
				);

				expect(result.current.tooltipProps.placement).toBe(placement);
			}
		});
	});

	describe("cleanup", () => {
		it("clears timeout on unmount", () => {
			const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

			const { result, unmount } = renderHook(() =>
				useShortcutTooltip("test-tooltip", {
					description: "Test description",
				}),
			);

			// Start a show timeout
			act(() => {
				result.current.triggerProps.onMouseEnter();
			});

			unmount();

			// clearTimeout should have been called
			expect(clearTimeoutSpy).toHaveBeenCalled();

			clearTimeoutSpy.mockRestore();
		});
	});

	describe("unique IDs", () => {
		it("generates unique tooltip IDs for different instances", () => {
			const { result: result1 } = renderHook(() =>
				useShortcutTooltip("tooltip-1", {
					description: "First tooltip",
				}),
			);

			const { result: result2 } = renderHook(() =>
				useShortcutTooltip("tooltip-2", {
					description: "Second tooltip",
				}),
			);

			expect(result1.current.tooltipProps.id).not.toBe(result2.current.tooltipProps.id);
		});
	});
});
