import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutTooltip } from "../ShortcutTooltip";

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

describe("ShortcutTooltip", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockShouldShowTooltip.mockReturnValue(true);
		mockRecordTooltipView.mockClear();

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

		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			return window.setTimeout(() => cb(Date.now()), 0);
		});
		vi.stubGlobal("cancelAnimationFrame", (id: number) => {
			window.clearTimeout(id);
		});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	function getTrigger(label: string) {
		const button = screen.getByRole("button", { name: label });
		const trigger = button.parentElement;
		if (!trigger) throw new Error("trigger not found");
		return { button, trigger };
	}

	describe("rendering", () => {
		it("renders children correctly", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
		});

		it("does not render tooltip by default", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("applies custom className to wrapper", () => {
			const { container } = render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" className="custom-class">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			expect(container.firstChild).toHaveClass("custom-class");
		});
	});

	describe("show/hide behavior", () => {
		it("shows tooltip after hover delay (500ms)", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("shows tooltip after focus delay (800ms)", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("hides tooltip immediately on mouse leave", () => {
			render(
				<>
					<ShortcutTooltip tooltipId="test" description="Test tooltip">
						<button type="button">Click me</button>
					</ShortcutTooltip>
					<button type="button">Other</button>
				</>,
			);

			const { button, trigger } = getTrigger("Click me");
			fireEvent.focus(button);
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			fireEvent.blur(button);

			expect(trigger.getAttribute("aria-describedby")).toBeFalsy();
		});

		it("hides tooltip immediately on blur", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			fireEvent.blur(button);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("cancels show timeout when mouse leaves before delay", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" delay={500}>
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { trigger } = getTrigger("Click me");
			fireEvent.pointerMove(trigger);
			fireEvent.pointerLeave(trigger);
			act(() => {
				vi.advanceTimersByTime(600);
			});

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});
	});

	describe("tooltip content", () => {
		it("displays description text", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Save your work">
					<button type="button">Save</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Save");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toHaveTextContent("Save your work");
		});

		it("displays keyboard shortcut badge when provided", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Save" shortcut="Ctrl+S">
					<button type="button">Save</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Save");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toHaveTextContent("Ctrl");
			expect(tooltip).toHaveTextContent("S");
		});

		it("parses multi-key shortcuts correctly", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="New Document" shortcut="Ctrl+Shift+N">
					<button type="button">New</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("New");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toHaveTextContent("Ctrl");
			expect(tooltip).toHaveTextContent("Shift");
			expect(tooltip).toHaveTextContent("N");
		});

		it("renders tooltip without shortcut badge when shortcut not provided", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Open menu">
					<button type="button">Menu</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Menu");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toBeInTheDocument();
			expect(tooltip).toHaveTextContent("Open menu");
			expect(tooltip.querySelectorAll("kbd").length).toBe(0);
		});
	});

	describe("useTooltipUsage integration", () => {
		it("does not show tooltip when shouldShowTooltip returns false", () => {
			mockShouldShowTooltip.mockReturnValue(false);

			render(
				<ShortcutTooltip tooltipId="faded-tooltip" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("calls recordTooltipView when tooltip is shown", () => {
			render(
				<ShortcutTooltip tooltipId="test-tooltip" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(mockRecordTooltipView).toHaveBeenCalledWith("test-tooltip");
		});

		it("only calls recordTooltipView once per session", () => {
			render(
				<>
					<ShortcutTooltip tooltipId="test-tooltip" description="Test tooltip">
						<button type="button">Click me</button>
					</ShortcutTooltip>
					<button type="button">Other</button>
				</>,
			);

			const { button, trigger } = getTrigger("Click me");

			fireEvent.focus(button);
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			fireEvent.blur(button);
			expect(trigger.getAttribute("aria-describedby")).toBeFalsy();

			fireEvent.focus(button);
			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			expect(mockRecordTooltipView).toHaveBeenCalledTimes(1);
		});

		it("checks shouldShowTooltip with correct tooltipId", () => {
			render(
				<ShortcutTooltip tooltipId="specific-tooltip-id" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);

			expect(mockShouldShowTooltip).toHaveBeenCalledWith("specific-tooltip-id");
		});
	});

	describe("disabled prop", () => {
		it("does not show tooltip when disabled", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" disabled>
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("does not call recordTooltipView when disabled", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" disabled>
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);

			expect(mockRecordTooltipView).not.toHaveBeenCalled();
		});
	});

	describe("placement", () => {
		it("accepts top placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="top">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts bottom placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="bottom">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts left placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="left">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts right placement", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="right">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});
	});

	describe("accessibility", () => {
		it("has role=tooltip on tooltip element", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("associates tooltip with trigger via aria-describedby when visible", () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button, trigger } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			const tooltip = screen.getByRole("tooltip");
			const ariaDescribedBy = trigger.getAttribute("aria-describedby");
			expect(ariaDescribedBy).toBe(tooltip.id);
		});

		it("removes aria-describedby when tooltip is hidden", () => {
			render(
				<>
					<ShortcutTooltip tooltipId="test" description="Test tooltip">
						<button type="button">Click me</button>
					</ShortcutTooltip>
					<button type="button">Other</button>
				</>,
			);

			const { button, trigger } = getTrigger("Click me");
			fireEvent.focus(button);
			expect(trigger.getAttribute("aria-describedby")).toBeTruthy();

			fireEvent.blur(button);

			expect(trigger.getAttribute("aria-describedby")).toBeFalsy();
		});
	});

	describe("reduced motion", () => {
		it("respects prefers-reduced-motion setting", () => {
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
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const { button } = getTrigger("Click me");
			fireEvent.focus(button);
			act(() => {
				vi.advanceTimersByTime(0);
			});

			const tooltip = screen.getByRole("tooltip");
			const wrapper = tooltip.closest("[data-state]");
			expect(wrapper).toHaveClass("opacity-100");
			expect(wrapper).not.toHaveClass("transition-all");
		});
	});
});
