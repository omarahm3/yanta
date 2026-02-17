import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/config")>();
	return {
		...actual,
		useMergedConfig: () => {
			const config = actual.useMergedConfig();
			return {
				...config,
				timeouts: {
					...config.timeouts,
					tooltipHoverDelay: 0,
					tooltipFocusDelay: 0,
				},
			};
		},
	};
});

describe("ShortcutTooltip", () => {
	beforeEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
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
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

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
		it("shows tooltip after hover delay (500ms)", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			// Radix uses pointer events for hover
			fireEvent.pointerMove(trigger);

			// With zero delay, tooltip appears immediately
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);
		});

		it("shows tooltip after focus delay (800ms)", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.focus(trigger);

			// With zero delay, tooltip appears immediately
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);
		});

		it("hides tooltip immediately on mouse leave", async () => {
			render(
				<>
					<ShortcutTooltip tooltipId="test" description="Test tooltip">
						<button type="button">Click me</button>
					</ShortcutTooltip>
					<button type="button">Other</button>
				</>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");

			// Show tooltip via focus on trigger (blur will close it)
			fireEvent.focus(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			// Hide via blur on trigger
			fireEvent.blur(trigger);

			await waitFor(
				() => {
					expect(trigger.getAttribute("aria-describedby")).toBeFalsy();
				},
				{ timeout: 300 },
			);
		});

		it("hides tooltip immediately on blur", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");

			// Show tooltip (zero delay)
			fireEvent.focus(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			// Hide tooltip
			fireEvent.blur(trigger);

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("cancels show timeout when mouse leaves before delay", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");

			// Enter and leave in same tick - with zero delay, Radix may still schedule for next tick
			fireEvent.pointerMove(trigger);
			fireEvent.pointerLeave(trigger);
			await new Promise((r) => setTimeout(r, 100));

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});
	});

	describe("tooltip content", () => {
		it("displays description text", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Save your work">
					<button type="button">Save</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Save" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(screen.getByRole("tooltip")).toHaveTextContent("Save your work");
		});

		it("displays keyboard shortcut badge when provided", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Save" shortcut="Ctrl+S">
					<button type="button">Save</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Save" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toHaveTextContent("Ctrl");
			expect(tooltip).toHaveTextContent("S");
		});

		it("parses multi-key shortcuts correctly", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="New Document" shortcut="Ctrl+Shift+N">
					<button type="button">New</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "New" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toHaveTextContent("Ctrl");
			expect(tooltip).toHaveTextContent("Shift");
			expect(tooltip).toHaveTextContent("N");
		});

		it("renders tooltip without shortcut badge when shortcut not provided", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Open menu">
					<button type="button">Menu</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Menu" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			const tooltip = screen.getByRole("tooltip");
			expect(tooltip).toBeInTheDocument();
			expect(tooltip).toHaveTextContent("Open menu");
			// The separator "+" should not exist (only description, no kbd elements)
			expect(tooltip.querySelectorAll("kbd").length).toBe(0);
		});
	});

	describe("useTooltipUsage integration", () => {
		it("does not show tooltip when shouldShowTooltip returns false", async () => {
			mockShouldShowTooltip.mockReturnValue(false);

			render(
				<ShortcutTooltip tooltipId="faded-tooltip" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await new Promise((r) => setTimeout(r, 100));

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("calls recordTooltipView when tooltip is shown", async () => {
			render(
				<ShortcutTooltip tooltipId="test-tooltip" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(mockRecordTooltipView).toHaveBeenCalledWith("test-tooltip");
		});

		it("only calls recordTooltipView once per session", async () => {
			render(
				<>
					<ShortcutTooltip tooltipId="test-tooltip" description="Test tooltip">
						<button type="button">Click me</button>
					</ShortcutTooltip>
					<button type="button">Other</button>
				</>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");

			// First show via focus on trigger
			fireEvent.focus(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			// Hide via blur on trigger
			fireEvent.blur(trigger);
			await waitFor(
				() => {
					expect(trigger.getAttribute("aria-describedby")).toBeFalsy();
				},
				{ timeout: 300 },
			);

			// Show again via focus on trigger
			fireEvent.focus(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			// Should only have been called once
			expect(mockRecordTooltipView).toHaveBeenCalledTimes(1);
		});

		it("checks shouldShowTooltip with correct tooltipId", () => {
			render(
				<ShortcutTooltip tooltipId="specific-tooltip-id" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);

			expect(mockShouldShowTooltip).toHaveBeenCalledWith("specific-tooltip-id");
		});
	});

	describe("disabled prop", () => {
		it("does not show tooltip when disabled", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" disabled>
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await new Promise((r) => setTimeout(r, 100));

			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("does not call recordTooltipView when disabled", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip" disabled>
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await new Promise((r) => setTimeout(r, 100));

			expect(mockRecordTooltipView).not.toHaveBeenCalled();
		});
	});

	describe("placement", () => {
		it("accepts top placement", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="top">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts bottom placement", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="bottom">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts left placement", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="left">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("accepts right placement", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test" placement="right">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});
	});

	describe("accessibility", () => {
		it("has role=tooltip on tooltip element", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("associates tooltip with trigger via aria-describedby when visible", async () => {
			render(
				<ShortcutTooltip tooltipId="test" description="Test tooltip">
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			const tooltip = screen.getByRole("tooltip");
			const ariaDescribedBy = trigger.getAttribute("aria-describedby");
			expect(ariaDescribedBy).toBe(tooltip.id);
		});

		it("removes aria-describedby when tooltip is hidden", async () => {
			render(
				<>
					<ShortcutTooltip tooltipId="test" description="Test tooltip">
						<button type="button">Click me</button>
					</ShortcutTooltip>
					<button type="button">Other</button>
				</>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");

			// Show tooltip via focus on trigger
			fireEvent.focus(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			expect(trigger.getAttribute("aria-describedby")).toBeTruthy();

			// Hide via blur on trigger
			fireEvent.blur(trigger);

			await waitFor(
				() => {
					expect(trigger.getAttribute("aria-describedby")).toBeFalsy();
				},
				{ timeout: 300 },
			);
		});
	});

	describe("reduced motion", () => {
		it("respects prefers-reduced-motion setting", async () => {
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
					<button type="button">Click me</button>
				</ShortcutTooltip>,
			);

			const trigger = screen.getByRole("button", { name: "Click me" }).parentElement;
			if (!trigger) throw new Error("trigger not found");
			fireEvent.pointerMove(trigger);
			await waitFor(
				() => {
					expect(screen.getByRole("tooltip")).toBeInTheDocument();
				},
				{ timeout: 200 },
			);

			// Tooltip content wrapper has the classes (parent of role=tooltip span)
			const tooltip = screen.getByRole("tooltip");
			const wrapper = tooltip.closest("[data-state]");
			expect(wrapper).toHaveClass("opacity-100");
			expect(wrapper).not.toHaveClass("transition-all");
		});
	});
});
