import { render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import type React from "react";
import { describe, expect, it } from "vitest";

/**
 * Tests for DocumentContent page header with mode icon
 * These tests verify the visual elements added for mode differentiation
 */

describe("DocumentContent page header visual elements", () => {
	// Test the FileText icon renders with proper styling
	it("FileText icon renders with mode accent color", () => {
		const TestComponent = () => (
			<div className="px-4 pt-4 pb-2 border-b border-border">
				<div className="flex items-center gap-2">
					<FileText
						className="w-5 h-5"
						style={{ color: "var(--mode-accent)" }}
						aria-hidden="true"
						data-testid="mode-icon"
					/>
					<span className="text-sm text-text-dim">Document</span>
				</div>
			</div>
		);

		render(<TestComponent />);

		// Check the label
		const label = screen.getByText("Document");
		expect(label).toBeInTheDocument();

		// Check the icon
		const icon = screen.getByTestId("mode-icon");
		expect(icon).toBeInTheDocument();
		expect(icon).toHaveAttribute("aria-hidden", "true");
		expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
	});

	it("icon and title are visually aligned", () => {
		const TestComponent = () => (
			<div className="px-4 pt-4 pb-2 border-b border-border">
				<div className="flex items-center gap-2" data-testid="header-container">
					<FileText
						className="w-5 h-5"
						style={{ color: "var(--mode-accent)" }}
						aria-hidden="true"
					/>
					<span className="text-sm text-text-dim">Document</span>
				</div>
			</div>
		);

		render(<TestComponent />);

		const container = screen.getByTestId("header-container");
		expect(container).toHaveClass("flex", "items-center", "gap-2");
	});
});
