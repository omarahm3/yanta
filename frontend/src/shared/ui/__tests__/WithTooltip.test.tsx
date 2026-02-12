import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WithTooltip } from "../WithTooltip";

// Mock the useTooltipUsage hook
const mockShouldShowTooltip = vi.fn();
const mockRecordTooltipView = vi.fn();

vi.mock("../../stores/tooltipUsage.store", () => ({
	...vi.importActual("../../stores/tooltipUsage.store"),
	useTooltipUsage: () => ({
		shouldShowTooltip: mockShouldShowTooltip,
		recordTooltipView: mockRecordTooltipView,
		getTooltipUsage: vi.fn(),
		getAllTooltipUsage: vi.fn(),
	}),
}));

describe("WithTooltip", () => {
	const HOVER_DELAY = 500;
	const FOCUS_DELAY = 800;

	beforeEach(() => {
		vi.useFakeTimers();
		mockShouldShowTooltip.mockReturnValue(true);
		mockRecordTooltipView.mockClear();
		// Mock matchMedia for reduced motion
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
		// Mock requestAnimationFrame to execute callback synchronously
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	describe("rendering", () => {
		it("renders children correctly", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
		});

		it("does not render tooltip by default", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("preserves child element props", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button" className="custom-class" data-testid="custom-btn">
						Click me
					</button>
				</WithTooltip>,
			);

			const button = screen.getByTestId("custom-btn");
			expect(button).toHaveClass("custom-class");
		});
	});

	describe("show/hide behavior", () => {
		it("shows tooltip after hover delay (500ms)", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);

			// Tooltip should not be visible immediately
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

			// Advance timers by less than hover delay
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY - 100);
			});
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

			// Advance to full hover delay
			act(() => {
				vi.advanceTimersByTime(100);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("shows tooltip after focus delay (800ms)", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.focus(button);

			// Tooltip should not be visible immediately
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

			// Advance timers by less than focus delay
			act(() => {
				vi.advanceTimersByTime(FOCUS_DELAY - 100);
			});
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

			// Advance to full focus delay
			act(() => {
				vi.advanceTimersByTime(100);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("hides tooltip immediately on mouse leave", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });

			// Show tooltip
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Hide tooltip
			fireEvent.mouseLeave(button);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("hides tooltip immediately on blur", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });

			// Show tooltip
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(FOCUS_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Hide tooltip
			fireEvent.blur(button);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("cancels show timeout when mouse leaves before delay", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });

			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY - 100);
			});
			fireEvent.mouseLeave(button);

			// Advance past the original delay
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});
	});

	describe("tooltip content", () => {
		it("displays description text", () => {
			render(
				<WithTooltip tooltipId="test" description="Save your work">
					<button type="button">Save</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Save" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByText("Save your work")).toBeInTheDocument();
		});

		it("displays keyboard shortcut badge when provided", () => {
			render(
				<WithTooltip tooltipId="test" description="Save" shortcut="Ctrl+S">
					<button type="button">Save</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Save" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByText("Ctrl")).toBeInTheDocument();
			expect(screen.getByText("S")).toBeInTheDocument();
		});

		it("parses multi-key shortcuts correctly", () => {
			render(
				<WithTooltip tooltipId="test" description="New Document" shortcut="Ctrl+Shift+N">
					<button type="button">New</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "New" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByText("Ctrl")).toBeInTheDocument();
			expect(screen.getByText("Shift")).toBeInTheDocument();
			expect(screen.getByText("N")).toBeInTheDocument();
		});

		it("renders tooltip without shortcut badge when shortcut not provided", () => {
			render(
				<WithTooltip tooltipId="test" description="Open menu">
					<button type="button">Menu</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Menu" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
			expect(screen.getByText("Open menu")).toBeInTheDocument();
			// No kbd elements should exist
			const tooltip = screen.getByRole("tooltip");
			expect(tooltip.querySelectorAll("kbd").length).toBe(0);
		});
	});

	describe("useTooltipUsage integration", () => {
		it("does not show tooltip when shouldShowTooltip returns false", () => {
			mockShouldShowTooltip.mockReturnValue(false);

			render(
				<WithTooltip tooltipId="faded-tooltip" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("calls recordTooltipView when tooltip is shown", () => {
			render(
				<WithTooltip tooltipId="test-tooltip" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(mockRecordTooltipView).toHaveBeenCalledWith("test-tooltip");
		});

		it("only calls recordTooltipView once per session", () => {
			render(
				<WithTooltip tooltipId="test-tooltip" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });

			// First hover
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Hide and show again
			fireEvent.mouseLeave(button);
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Should only have been called once
			expect(mockRecordTooltipView).toHaveBeenCalledTimes(1);
		});

		it("checks shouldShowTooltip with correct tooltipId", () => {
			render(
				<WithTooltip tooltipId="specific-tooltip-id" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);

			expect(mockShouldShowTooltip).toHaveBeenCalledWith("specific-tooltip-id");
		});
	});

	describe("disabled prop", () => {
		it("does not show tooltip when disabled", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip" disabled>
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("does not call recordTooltipView when disabled", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip" disabled>
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(mockRecordTooltipView).not.toHaveBeenCalled();
		});
	});

	describe("placement", () => {
		it("accepts top placement", () => {
			render(
				<WithTooltip tooltipId="test" description="Test" placement="top">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts bottom placement", () => {
			render(
				<WithTooltip tooltipId="test" description="Test" placement="bottom">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts left placement", () => {
			render(
				<WithTooltip tooltipId="test" description="Test" placement="left">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts right placement", () => {
			render(
				<WithTooltip tooltipId="test" description="Test" placement="right">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});
	});

	describe("accessibility", () => {
		it("has role=tooltip on tooltip element", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("associates tooltip with trigger via aria-describedby when visible", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			const tooltip = screen.getByRole("tooltip");
			const ariaDescribedBy = button.getAttribute("aria-describedby");
			expect(ariaDescribedBy).toBe(tooltip.id);
		});

		it("removes aria-describedby when tooltip is hidden", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });

			// Show tooltip
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(button.getAttribute("aria-describedby")).toBeTruthy();

			// Hide tooltip
			fireEvent.mouseLeave(button);

			expect(button.getAttribute("aria-describedby")).toBeFalsy();
		});
	});

	describe("reduced motion", () => {
		it("respects prefers-reduced-motion setting", () => {
			// Mock matchMedia to return true for reduced motion
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: vi.fn().mockImplementation((query: string) => ({
					matches: query === "(prefers-reduced-motion: reduce)",
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
				})),
			});

			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toHaveClass("opacity-100");
			// Should not have transition classes
			expect(tooltip).not.toHaveClass("transition-all");
		});
	});

	describe("event handler preservation", () => {
		it("calls original onMouseEnter handler", () => {
			const originalHandler = vi.fn();
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button" onMouseEnter={originalHandler}>
						Click me
					</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseEnter(button);

			expect(originalHandler).toHaveBeenCalled();
		});

		it("calls original onMouseLeave handler", () => {
			const originalHandler = vi.fn();
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button" onMouseLeave={originalHandler}>
						Click me
					</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.mouseLeave(button);

			expect(originalHandler).toHaveBeenCalled();
		});

		it("calls original onFocus handler", () => {
			const originalHandler = vi.fn();
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button" onFocus={originalHandler}>
						Click me
					</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.focus(button);

			expect(originalHandler).toHaveBeenCalled();
		});

		it("calls original onBlur handler", () => {
			const originalHandler = vi.fn();
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button" onBlur={originalHandler}>
						Click me
					</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Click me" });
			fireEvent.blur(button);

			expect(originalHandler).toHaveBeenCalled();
		});
	});

	describe("different child element types", () => {
		it("works with button elements", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Button</button>
				</WithTooltip>,
			);

			const button = screen.getByRole("button", { name: "Button" });
			fireEvent.mouseEnter(button);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("works with anchor elements", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<a href="/">Link</a>
				</WithTooltip>,
			);

			const link = screen.getByRole("link", { name: "Link" });
			fireEvent.mouseEnter(link);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("works with div elements", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<div data-testid="div-trigger">Content</div>
				</WithTooltip>,
			);

			const div = screen.getByTestId("div-trigger");
			fireEvent.mouseEnter(div);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("works with span elements", () => {
			render(
				<WithTooltip tooltipId="test" description="Test tooltip">
					<span data-testid="span-trigger">Text</span>
				</WithTooltip>,
			);

			const span = screen.getByTestId("span-trigger");
			fireEvent.mouseEnter(span);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});
	});
});
