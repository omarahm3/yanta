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
		expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
	});

	it("renders BookOpen icon for journal mode", () => {
		render(<ContextBar mode="journal" pageName="Journal" />);
		const icon = screen.getByTestId("context-bar-mode-icon");
		expect(icon).toBeInTheDocument();
		expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
	});

	it("renders FileText icon for neutral mode", () => {
		render(<ContextBar mode="neutral" pageName="Settings" />);
		const icon = screen.getByTestId("context-bar-mode-icon");
		expect(icon).toBeInTheDocument();
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

	it("has small font size (12px) on the container", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		const container = screen.getByTestId("context-bar");
		expect(container).toHaveStyle({ fontSize: "12px" });
	});

	it("has smaller font size (11px) on keyboard hint", () => {
		render(<ContextBar mode="documents" pageName="Documents" />);
		const keyboardHint = screen.getByTestId("context-bar-keyboard-hint");
		expect(keyboardHint).toHaveStyle({ fontSize: "11px" });
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
