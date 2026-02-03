import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeOverlay } from "../WelcomeOverlay";

const STORAGE_KEY = "yanta_onboarding";

describe("WelcomeOverlay", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("visibility", () => {
		it("does not render when onboarding is complete", () => {
			const existingData = {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
		});

		it("does not render initially before delay", () => {
			render(<WelcomeOverlay />);

			expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
		});

		it("renders after 500ms delay when onboarding not complete", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();
		});
	});

	describe("content", () => {
		it("displays the welcome title", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByText("Welcome to YANTA")).toBeInTheDocument();
		});

		it("displays the tagline", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByText("Your keyboard-first note-taking companion")).toBeInTheDocument();
		});

		it("displays Ctrl+K shortcut for command palette", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByText("Ctrl")).toBeInTheDocument();
			expect(screen.getByText("K")).toBeInTheDocument();
			expect(screen.getByText("Open Command Palette")).toBeInTheDocument();
		});

		it("displays ? shortcut for help", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByText("?")).toBeInTheDocument();
			expect(screen.getByText("View All Shortcuts")).toBeInTheDocument();
		});

		it("displays tip about command palette shortcuts", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(
				screen.getByText("The command palette shows keyboard shortcuts for each action."),
			).toBeInTheDocument();
		});

		it("displays the dismiss button", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByText("Got it, let's start")).toBeInTheDocument();
		});
	});

	describe("accessibility", () => {
		it("has correct aria attributes", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			const dialog = screen.getByRole("dialog");
			expect(dialog).toHaveAttribute("aria-modal", "true");
			expect(dialog).toHaveAttribute("aria-labelledby", "welcome-title");
			expect(dialog).toHaveAttribute("aria-describedby", "welcome-description");
		});

		it("focuses the dismiss button when overlay appears", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			const button = screen.getByTestId("welcome-dismiss-button");
			expect(document.activeElement).toBe(button);
		});
	});

	describe("dismissal", () => {
		it("dismisses when clicking the button", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();

			fireEvent.click(screen.getByTestId("welcome-dismiss-button"));

			expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
		});

		it("dismisses when pressing Enter", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();

			fireEvent.keyDown(window, { key: "Enter" });

			expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
		});

		it("dismisses when pressing Escape", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();

			fireEvent.keyDown(window, { key: "Escape" });

			expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
		});

		it("marks onboarding as complete on dismiss", () => {
			vi.setSystemTime(new Date(5000));
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			fireEvent.click(screen.getByTestId("welcome-dismiss-button"));

			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
			expect(stored.completedWelcome).toBe(true);
			expect(stored.completedAt).toBe(5500); // 5000 + 500ms delay
		});

		it("does not dismiss when clicking the backdrop", () => {
			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			const overlay = screen.getByTestId("welcome-overlay");
			const backdrop = overlay.querySelector('[aria-hidden="true"]');

			if (backdrop) {
				fireEvent.click(backdrop);
			}

			expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();
		});
	});

	describe("keyboard cleanup", () => {
		it("removes keyboard listener on dismiss", () => {
			const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

			render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			fireEvent.click(screen.getByTestId("welcome-dismiss-button"));

			expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function), true);

			removeEventListenerSpy.mockRestore();
		});

		it("removes keyboard listener on unmount", () => {
			const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

			const { unmount } = render(<WelcomeOverlay />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			unmount();

			expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function), true);

			removeEventListenerSpy.mockRestore();
		});
	});

	describe("styling", () => {
		it("applies custom className", () => {
			render(<WelcomeOverlay className="custom-class" />);

			act(() => {
				vi.advanceTimersByTime(500);
			});

			const overlay = screen.getByTestId("welcome-overlay");
			expect(overlay).toHaveClass("custom-class");
		});
	});
});
