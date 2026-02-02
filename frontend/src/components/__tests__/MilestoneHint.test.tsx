import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MilestoneHint } from "../MilestoneHint";

describe("MilestoneHint", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("rendering", () => {
		it("renders the hint with correct content", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Press Ctrl+S to save quickly"
					onDismiss={onDismiss}
				/>
			);

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
			expect(screen.getByText("Tip:")).toBeInTheDocument();
			expect(screen.getByText("Press Ctrl+S to save quickly")).toBeInTheDocument();
		});

		it("renders with the correct hint id attribute", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="first-save"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			const hint = screen.getByTestId("milestone-hint");
			expect(hint).toHaveAttribute("data-hint-id", "first-save");
		});

		it("renders the dismiss button", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			expect(screen.getByTestId("milestone-hint-dismiss")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Dismiss hint" })).toBeInTheDocument();
		});

		it("applies custom className", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
					className="custom-class"
				/>
			);

			const hint = screen.getByTestId("milestone-hint");
			expect(hint).toHaveClass("custom-class");
		});
	});

	describe("accessibility", () => {
		it("has correct aria attributes", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			const hint = screen.getByTestId("milestone-hint");
			expect(hint).toHaveAttribute("role", "status");
			expect(hint).toHaveAttribute("aria-live", "polite");
		});

		it("dismiss button has accessible name", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			const dismissButton = screen.getByTestId("milestone-hint-dismiss");
			expect(dismissButton).toHaveAttribute("aria-label", "Dismiss hint");
		});
	});

	describe("dismissal on click", () => {
		it("calls onDismiss with hintId after clicking dismiss button", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));

			// Wait for exit animation
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(onDismiss).toHaveBeenCalledWith("test-hint");
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it("removes from DOM after dismiss animation", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();

			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));

			// Wait for exit animation
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(screen.queryByTestId("milestone-hint")).not.toBeInTheDocument();
		});

		it("starts exit animation immediately on click", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));

			// Before animation completes, element should still be in DOM but with exit classes
			const hint = screen.getByTestId("milestone-hint");
			expect(hint).toHaveClass("opacity-0");
			expect(hint).toHaveClass("translate-y-2");
		});
	});

	describe("auto-dismiss", () => {
		it("auto-dismisses after 8 seconds by default", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();

			// Advance to just before auto-dismiss
			act(() => {
				vi.advanceTimersByTime(7999);
			});

			expect(onDismiss).not.toHaveBeenCalled();

			// Advance to trigger auto-dismiss
			act(() => {
				vi.advanceTimersByTime(1);
			});

			// Wait for exit animation
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(onDismiss).toHaveBeenCalledWith("test-hint");
		});

		it("uses custom autoDismissMs value", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
					autoDismissMs={3000}
				/>
			);

			act(() => {
				vi.advanceTimersByTime(2999);
			});

			expect(onDismiss).not.toHaveBeenCalled();

			act(() => {
				vi.advanceTimersByTime(1);
			});

			// Wait for exit animation
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(onDismiss).toHaveBeenCalledWith("test-hint");
		});

		it("does not auto-dismiss when autoDismissMs is 0", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
					autoDismissMs={0}
				/>
			);

			act(() => {
				vi.advanceTimersByTime(20000);
			});

			expect(onDismiss).not.toHaveBeenCalled();
			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
		});

		it("does not auto-dismiss when autoDismissMs is negative", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
					autoDismissMs={-1}
				/>
			);

			act(() => {
				vi.advanceTimersByTime(20000);
			});

			expect(onDismiss).not.toHaveBeenCalled();
			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
		});
	});

	describe("cleanup", () => {
		it("clears auto-dismiss timer on unmount", () => {
			const onDismiss = vi.fn();
			const { unmount } = render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			unmount();

			// Advance past auto-dismiss time
			act(() => {
				vi.advanceTimersByTime(10000);
			});

			expect(onDismiss).not.toHaveBeenCalled();
		});

		it("clears auto-dismiss timer when manually dismissed", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));

			// Wait for exit animation
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(onDismiss).toHaveBeenCalledTimes(1);

			// Advance past original auto-dismiss time
			act(() => {
				vi.advanceTimersByTime(10000);
			});

			// Should still only have been called once
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});
	});

	describe("styling", () => {
		it("has correct base positioning classes", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			const hint = screen.getByTestId("milestone-hint");
			expect(hint).toHaveClass("fixed");
			expect(hint).toHaveClass("bottom-4");
			expect(hint).toHaveClass("left-1/2");
			expect(hint).toHaveClass("-translate-x-1/2");
		});

		it("has correct visual styling classes", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			const hint = screen.getByTestId("milestone-hint");
			expect(hint).toHaveClass("bg-surface");
			expect(hint).toHaveClass("border");
			expect(hint).toHaveClass("border-border");
			expect(hint).toHaveClass("shadow-lg");
			expect(hint).toHaveClass("rounded-lg");
		});

		it("tip label has accent color", () => {
			const onDismiss = vi.fn();
			render(
				<MilestoneHint
					hintId="test-hint"
					text="Test hint"
					onDismiss={onDismiss}
				/>
			);

			const tipLabel = screen.getByText("Tip:");
			expect(tipLabel).toHaveClass("text-accent");
			expect(tipLabel).toHaveClass("font-semibold");
		});
	});
});
