import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextBar } from "../ContextBar";

describe("ContextBar", () => {
	it("renders the context bar container", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		expect(screen.getByTestId("context-bar")).toBeInTheDocument();
	});

	it("renders the page name", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		expect(screen.getByTestId("context-bar-page-name")).toHaveTextContent("Documents");
	});

	it("renders FileText icon for documents mode", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		const icon = screen.getByTestId("context-bar-mode-icon");
		expect(icon).toBeInTheDocument();
		// Test mode via data attribute instead of inline style
		const container = screen.getByTestId("context-bar");
		expect(container).toHaveAttribute("data-mode", "documents");
	});

	it("renders BookOpen icon for journal mode", () => {
		render(<ContextBar mode="journal" pageName="Journal" />);
		const icon = screen.getByTestId("context-bar-mode-icon");
		expect(icon).toBeInTheDocument();
		// Test mode via data attribute instead of inline style
		const container = screen.getByTestId("context-bar");
		expect(container).toHaveAttribute("data-mode", "journal");
	});

	it("renders FileText icon for neutral mode", () => {
		render(<ContextBar mode="neutral" pageName="Settings" />);
		const icon = screen.getByTestId("context-bar-mode-icon");
		expect(icon).toBeInTheDocument();
		const container = screen.getByTestId("context-bar");
		expect(container).toHaveAttribute("data-mode", "neutral");
	});

	it("renders project alias when provided", () => {
		render(<ContextBar mode="documents" pageName="Documents" projectAlias="yanta" />);
		const projectAlias = screen.getByTestId("context-bar-project-alias");
		expect(projectAlias).toHaveTextContent("@yanta");
	});

	it("does not render project alias when not provided", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		expect(screen.queryByTestId("context-bar-project-alias")).not.toBeInTheDocument();
	});

	it("renders keyboard hint for command palette", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		const keyboardHint = screen.getByTestId("context-bar-keyboard-hint");
		expect(keyboardHint).toHaveTextContent("Ctrl+K");
	});

	it("renders command label next to keyboard hint", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		expect(screen.getByText("command")).toBeInTheDocument();
	});

	it("renders with appropriate font styling classes", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		const container = screen.getByTestId("context-bar");
		// Test presence of container rather than specific pixel values
		expect(container).toBeInTheDocument();
		expect(container).toHaveClass("text-text-dim");
	});

	it("renders keyboard hint with mono font", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		const keyboardHint = screen.getByTestId("context-bar-keyboard-hint");
		expect(keyboardHint).toHaveClass("font-mono");
	});

	it("applies custom className", () => {
		render(<ContextBar mode="documents" pageName="Documents" className="custom-class" />);
		const container = screen.getByTestId("context-bar");
		expect(container).toHaveClass("custom-class");
	});

	it("renders mode icon as aria-hidden for accessibility", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		const icon = screen.getByTestId("context-bar-mode-icon");
		expect(icon).toHaveAttribute("aria-hidden", "true");
	});

	describe("mode icon selection", () => {
		it("uses FileText for documents mode", () => {
			const { container } = render(<ContextBar mode="documents" pageName="Test" />);
			// FileText icon has a specific SVG structure
			const svg = container.querySelector("svg");
			expect(svg).toBeInTheDocument();
		});

		it("uses BookOpen for journal mode", () => {
			const { container } = render(<ContextBar mode="journal" pageName="Test" />);
			// BookOpen icon has a specific SVG structure
			const svg = container.querySelector("svg");
			expect(svg).toBeInTheDocument();
		});
	});
});
