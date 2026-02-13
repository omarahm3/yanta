import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type FooterHint, FooterHintBar } from "../FooterHintBar";

describe("FooterHintBar", () => {
	const defaultHints: FooterHint[] = [
		{ key: "↑↓", label: "Navigate" },
		{ key: "Enter", label: "Open" },
		{ key: "Esc", label: "Back" },
	];

	it("renders the footer hint bar container", () => {
		render(<FooterHintBar hints={defaultHints} />);
		expect(screen.getByTestId("footer-hint-bar")).toBeInTheDocument();
	});

	it("renders all provided hints", () => {
		render(<FooterHintBar hints={defaultHints} />);
		expect(screen.getByText("Navigate")).toBeInTheDocument();
		expect(screen.getByText("Open")).toBeInTheDocument();
		expect(screen.getByText("Back")).toBeInTheDocument();
	});

	it("renders keyboard keys in kbd elements", () => {
		const { container } = render(<FooterHintBar hints={defaultHints} />);
		const kbdElements = container.querySelectorAll("kbd");
		expect(kbdElements.length).toBe(3);
		expect(kbdElements[0]).toHaveTextContent("↑↓");
		expect(kbdElements[1]).toHaveTextContent("Enter");
		expect(kbdElements[2]).toHaveTextContent("Esc");
	});

	it("renders nothing when hints array is empty", () => {
		render(<FooterHintBar hints={[]} />);
		expect(screen.queryByTestId("footer-hint-bar")).not.toBeInTheDocument();
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

	it("renders single hint correctly", () => {
		render(<FooterHintBar hints={[{ key: "Esc", label: "Back" }]} />);
		expect(screen.getByText("Esc")).toBeInTheDocument();
		expect(screen.getByText("Back")).toBeInTheDocument();
	});

	describe("Priority and Responsive CSS Classes", () => {
		const hintsWithPriority: FooterHint[] = [
			{ key: "↑↓", label: "Navigate", priority: 1 },
			{ key: "Enter", label: "Open", priority: 2 },
			{ key: "Ctrl+N", label: "New", priority: 3 },
			{ key: "Esc", label: "Back", priority: 1 },
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

		it("applies 'flex' class to priority 1 hints (always visible)", () => {
			render(<FooterHintBar hints={hintsWithPriority} />);
			const p1Hints = screen.getByTestId("footer-hint-bar").querySelectorAll("[data-priority='1']");
			for (const hint of p1Hints) {
				expect(hint).toHaveClass("flex");
				expect(hint).not.toHaveClass("hidden");
			}
		});

		it("applies 'flex' class to priority 2 hints (always visible, wrapping handles overflow)", () => {
			render(<FooterHintBar hints={hintsWithPriority} />);
			const p2Hints = screen.getByTestId("footer-hint-bar").querySelectorAll("[data-priority='2']");
			for (const hint of p2Hints) {
				expect(hint).toHaveClass("flex");
				expect(hint).not.toHaveClass("hidden");
			}
		});

		it("applies 'hidden md:flex' classes to priority 3 hints", () => {
			render(<FooterHintBar hints={hintsWithPriority} />);
			const p3Hints = screen.getByTestId("footer-hint-bar").querySelectorAll("[data-priority='3']");
			for (const hint of p3Hints) {
				expect(hint).toHaveClass("hidden", "md:flex");
			}
		});

		it("renders all hints in the DOM regardless of priority (CSS handles visibility)", () => {
			render(<FooterHintBar hints={hintsWithPriority} />);
			expect(screen.getByText("Navigate")).toBeInTheDocument();
			expect(screen.getByText("Open")).toBeInTheDocument();
			expect(screen.getByText("New")).toBeInTheDocument();
			expect(screen.getByText("Back")).toBeInTheDocument();
		});
	});
});
