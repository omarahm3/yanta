import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FooterHint, FooterHintBar } from "../FooterHintBar";

describe("FooterHintBar", () => {
	const defaultHints: FooterHint[] = [
		{ key: "↑↓", label: "Navigate" },
		{ key: "Enter", label: "Open" },
		{ key: "Ctrl+K", label: "Commands" },
	];

	it("renders the footer hint bar container", () => {
		render(<FooterHintBar hints={defaultHints} />);
		expect(screen.getByTestId("footer-hint-bar")).toBeInTheDocument();
	});

	it("renders all provided hints", () => {
		render(<FooterHintBar hints={defaultHints} />);
		expect(screen.getByText("Navigate")).toBeInTheDocument();
		expect(screen.getByText("Open")).toBeInTheDocument();
		expect(screen.getByText("Commands")).toBeInTheDocument();
	});

	it("renders keyboard keys in kbd elements", () => {
		const { container } = render(<FooterHintBar hints={defaultHints} />);
		const kbdElements = container.querySelectorAll("kbd");
		expect(kbdElements.length).toBe(3);
		expect(kbdElements[0]).toHaveTextContent("↑↓");
		expect(kbdElements[1]).toHaveTextContent("Enter");
		expect(kbdElements[2]).toHaveTextContent("Ctrl+K");
	});

	it("renders nothing when hints array is empty", () => {
		render(<FooterHintBar hints={[]} />);
		expect(screen.queryByTestId("footer-hint-bar")).not.toBeInTheDocument();
	});

	it("has fixed position at bottom of viewport", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("fixed", "bottom-0", "left-0", "right-0");
	});

	it("has correct height of 32px (h-8)", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("h-8");
	});

	it("has correct flex layout with gap", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("flex", "items-center", "gap-4");
	});

	it("has correct padding", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("px-4");
	});

	it("has small text (text-xs)", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("text-xs");
	});

	it("has muted text color", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("text-text-dim");
	});

	it("has surface background", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("bg-surface");
	});

	it("has border at top", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("border-t", "border-border");
	});

	it("applies custom className", () => {
		render(<FooterHintBar hints={defaultHints} className="custom-class" />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("custom-class");
	});

	it("renders keyboard badge with monospace font", () => {
		render(<FooterHintBar hints={[{ key: "Ctrl+K", label: "Commands" }]} />);
		const kbd = screen.getByText("Ctrl+K");
		expect(kbd).toHaveClass("font-mono");
	});

	it("renders keyboard badge with background styling", () => {
		render(<FooterHintBar hints={[{ key: "Ctrl+K", label: "Commands" }]} />);
		const kbd = screen.getByText("Ctrl+K");
		expect(kbd).toHaveClass("bg-bg");
	});

	it("renders keyboard badge with padding and border radius", () => {
		render(<FooterHintBar hints={[{ key: "Ctrl+K", label: "Commands" }]} />);
		const kbd = screen.getByText("Ctrl+K");
		expect(kbd).toHaveClass("px-1.5", "py-0.5", "rounded");
	});

	it("renders keyboard badge with border", () => {
		render(<FooterHintBar hints={[{ key: "Ctrl+K", label: "Commands" }]} />);
		const kbd = screen.getByText("Ctrl+K");
		expect(kbd).toHaveClass("border", "border-border");
	});

	it("renders single hint correctly", () => {
		render(<FooterHintBar hints={[{ key: "Esc", label: "Back" }]} />);
		expect(screen.getByText("Esc")).toBeInTheDocument();
		expect(screen.getByText("Back")).toBeInTheDocument();
	});

	it("has z-index for proper layering", () => {
		render(<FooterHintBar hints={defaultHints} />);
		const container = screen.getByTestId("footer-hint-bar");
		expect(container).toHaveClass("z-40");
	});

	describe("Priority and Responsive Collapse", () => {
		const hintsWithPriority: FooterHint[] = [
			{ key: "↑↓", label: "Navigate", priority: 1 },
			{ key: "Enter", label: "Open", priority: 2 },
			{ key: "Ctrl+N", label: "New", priority: 3 },
			{ key: "Ctrl+K", label: "Commands", priority: 1 },
		];

		it("renders hints with data-priority attribute", () => {
			render(<FooterHintBar hints={hintsWithPriority} />);
			const hintElements = screen.getByTestId("footer-hint-bar").querySelectorAll("[data-priority]");
			expect(hintElements.length).toBe(4);
			expect(hintElements[0]).toHaveAttribute("data-priority", "1");
			expect(hintElements[1]).toHaveAttribute("data-priority", "2");
			expect(hintElements[2]).toHaveAttribute("data-priority", "3");
			expect(hintElements[3]).toHaveAttribute("data-priority", "1");
		});

		it("defaults to priority 2 when priority is not specified", () => {
			const hintsWithoutPriority: FooterHint[] = [{ key: "Enter", label: "Open" }];
			render(<FooterHintBar hints={hintsWithoutPriority} />);
			const hintElement = screen.getByTestId("footer-hint-bar").querySelector("[data-priority]");
			expect(hintElement).toHaveAttribute("data-priority", "2");
		});

		it("renders all hints on wide viewports (>= 768px)", () => {
			// Default window.innerWidth in JSDOM is 1024px
			render(<FooterHintBar hints={hintsWithPriority} />);
			expect(screen.getByText("Navigate")).toBeInTheDocument();
			expect(screen.getByText("Open")).toBeInTheDocument();
			expect(screen.getByText("New")).toBeInTheDocument();
			expect(screen.getByText("Commands")).toBeInTheDocument();
		});
	});

	describe("Responsive behavior with mocked media query", () => {
		let mediaQueryListeners: ((e: MediaQueryListEvent) => void)[] = [];
		let currentMatches = false;

		beforeEach(() => {
			mediaQueryListeners = [];
			currentMatches = false;

			// Mock matchMedia
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: vi.fn().mockImplementation((query: string) => ({
					matches: currentMatches,
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
						if (event === "change") {
							mediaQueryListeners.push(listener);
						}
					}),
					removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
						if (event === "change") {
							mediaQueryListeners = mediaQueryListeners.filter((l) => l !== listener);
						}
					}),
					dispatchEvent: vi.fn(),
				})),
			});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("shows only priority 1 hints on narrow viewports (< 768px)", () => {
			currentMatches = true; // Narrow viewport

			const hintsWithPriority: FooterHint[] = [
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 2 },
				{ key: "Ctrl+N", label: "New", priority: 3 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			];

			render(<FooterHintBar hints={hintsWithPriority} />);

			// Priority 1 hints should be visible
			expect(screen.getByText("Navigate")).toBeInTheDocument();
			expect(screen.getByText("Commands")).toBeInTheDocument();

			// Priority 2 and 3 hints should be hidden
			expect(screen.queryByText("Open")).not.toBeInTheDocument();
			expect(screen.queryByText("New")).not.toBeInTheDocument();
		});

		it("renders nothing when no priority 1 hints exist on narrow viewport", () => {
			currentMatches = true; // Narrow viewport

			const hintsAllLowPriority: FooterHint[] = [
				{ key: "Enter", label: "Open", priority: 2 },
				{ key: "Ctrl+N", label: "New", priority: 3 },
			];

			render(<FooterHintBar hints={hintsAllLowPriority} />);

			expect(screen.queryByTestId("footer-hint-bar")).not.toBeInTheDocument();
		});

		it("updates when viewport changes from wide to narrow", () => {
			currentMatches = false; // Start with wide viewport

			const hintsWithPriority: FooterHint[] = [
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			];

			render(<FooterHintBar hints={hintsWithPriority} />);

			// All hints visible on wide viewport
			expect(screen.getByText("Navigate")).toBeInTheDocument();
			expect(screen.getByText("Open")).toBeInTheDocument();
			expect(screen.getByText("Commands")).toBeInTheDocument();

			// Simulate viewport change to narrow
			act(() => {
				for (const listener of mediaQueryListeners) {
					listener({ matches: true } as MediaQueryListEvent);
				}
			});

			// Only priority 1 hints should remain
			expect(screen.getByText("Navigate")).toBeInTheDocument();
			expect(screen.getByText("Commands")).toBeInTheDocument();
			expect(screen.queryByText("Open")).not.toBeInTheDocument();
		});

		it("updates when viewport changes from narrow to wide", () => {
			currentMatches = true; // Start with narrow viewport

			const hintsWithPriority: FooterHint[] = [
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			];

			render(<FooterHintBar hints={hintsWithPriority} />);

			// Only priority 1 hints visible on narrow viewport
			expect(screen.getByText("Navigate")).toBeInTheDocument();
			expect(screen.queryByText("Open")).not.toBeInTheDocument();
			expect(screen.getByText("Commands")).toBeInTheDocument();

			// Simulate viewport change to wide
			act(() => {
				for (const listener of mediaQueryListeners) {
					listener({ matches: false } as MediaQueryListEvent);
				}
			});

			// All hints should now be visible
			expect(screen.getByText("Navigate")).toBeInTheDocument();
			expect(screen.getByText("Open")).toBeInTheDocument();
			expect(screen.getByText("Commands")).toBeInTheDocument();
		});
	});
});
