import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FooterHintBar, type FooterHint } from "../FooterHintBar";

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
});
