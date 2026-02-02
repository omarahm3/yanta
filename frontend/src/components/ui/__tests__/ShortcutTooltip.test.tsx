import { act, render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { ShortcutTooltip } from "../ShortcutTooltip";

// Mock the useTooltipUsage hook
const mockShouldShowTooltip = vi.fn();
const mockRecordTooltipView = vi.fn();

vi.mock("../../../hooks/useTooltipUsage", () => ({
	useTooltipUsage: () => ({
		shouldShowTooltip: mockShouldShowTooltip,
		recordTooltipView: mockRecordTooltipView,
		getTooltipUsage: vi.fn(),
		getAllTooltipUsage: vi.fn(),
	}),
}));

describe("ShortcutTooltip", () => {
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
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
		});

		it("does not render tooltip by default", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("applies custom className to wrapper", () => {
			const { container } = render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" className="custom-class">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			expect(container.firstChild).toHaveClass("custom-class");
		});
	});

	describe("show/hide behavior", () => {
		it("shows tooltip after hover delay (500ms)", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);

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
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.focus(trigger);

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
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;

			// Show tooltip
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Hide tooltip
			fireEvent.mouseLeave(trigger);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("hides tooltip immediately on blur", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;

			// Show tooltip
			fireEvent.focus(trigger);
			act(() => {
				vi.advanceTimersByTime(FOCUS_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Hide tooltip
			fireEvent.blur(trigger);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("cancels show timeout when mouse leaves before delay", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;

			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY - 100);
			});
			fireEvent.mouseLeave(trigger);

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
				<ShortcutTooltip tooltipId="test" description="Save your work">
					<button>Save</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Save" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByText("Save your work")).toBeInTheDocument();
		});

		it("displays keyboard shortcut badge when provided", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Save" shortcut="Ctrl+S">
					<button>Save</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Save" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByText("Ctrl")).toBeInTheDocument();
			expect(screen.getByText("S")).toBeInTheDocument();
		});

		it("parses multi-key shortcuts correctly", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="New Document" shortcut="Ctrl+Shift+N">
					<button>New</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "New" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByText("Ctrl")).toBeInTheDocument();
			expect(screen.getByText("Shift")).toBeInTheDocument();
			expect(screen.getByText("N")).toBeInTheDocument();
		});

		it("renders tooltip without shortcut badge when shortcut not provided", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Open menu">
					<button>Menu</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Menu" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
			expect(screen.getByText("Open menu")).toBeInTheDocument();
			// The separator "+" should not exist (only description, no kbd elements)
			const tooltip = screen.getByRole("tooltip");
			expect(tooltip.querySelectorAll("kbd").length).toBe(0);
		});
	});

	describe("useTooltipUsage integration", () => {
		it("does not show tooltip when shouldShowTooltip returns false", () => {
			mockShouldShowTooltip.mockReturnValue(false);

			render(
				<ShortcutTooltip tooltipId="faded-tooltip" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("calls recordTooltipView when tooltip is shown", () => {
			render(
				<ShortcutTooltip tooltipId="test-tooltip" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(mockRecordTooltipView).toHaveBeenCalledWith("test-tooltip");
		});

		it("only calls recordTooltipView once per session", () => {
			render(
				<ShortcutTooltip tooltipId="test-tooltip" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;

			// First hover
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Hide and show again
			fireEvent.mouseLeave(trigger);
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Should only have been called once
			expect(mockRecordTooltipView).toHaveBeenCalledTimes(1);
		});

		it("checks shouldShowTooltip with correct tooltipId", () => {
			render(
				<ShortcutTooltip tooltipId="specific-tooltip-id" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);

			expect(mockShouldShowTooltip).toHaveBeenCalledWith("specific-tooltip-id");
		});
	});

	describe("disabled prop", () => {
		it("does not show tooltip when disabled", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" disabled>
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("does not call recordTooltipView when disabled", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" disabled>
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(mockRecordTooltipView).not.toHaveBeenCalled();
		});
	});

	describe("placement", () => {
		it("accepts top placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="top">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts bottom placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="bottom">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts left placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="left">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts right placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="right">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});
	});

	describe("accessibility", () => {
		it("has role=tooltip on tooltip element", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("associates tooltip with trigger via aria-describedby when visible", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			const tooltip = screen.getByRole("tooltip");
			const ariaDescribedBy = trigger.getAttribute("aria-describedby");
			expect(ariaDescribedBy).toBe(tooltip.id);
		});

		it("removes aria-describedby when tooltip is hidden", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;

			// Show tooltip
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			expect(trigger.getAttribute("aria-describedby")).toBeTruthy();

			// Hide tooltip
			fireEvent.mouseLeave(trigger);

			expect(trigger.getAttribute("aria-describedby")).toBeFalsy();
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
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button>Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement!;
			fireEvent.mouseEnter(trigger);
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY);
			});

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toHaveClass("opacity-100");
			// Should not have transition classes
			expect(tooltip).not.toHaveClass("transition-all");
		});
	});
});
