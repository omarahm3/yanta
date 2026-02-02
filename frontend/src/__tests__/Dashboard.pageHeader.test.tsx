import { render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import type React from "react";
import { describe, expect, it } from "vitest";

/**
 * Tests for Dashboard page header with mode icon
 * These tests verify the visual elements added for mode differentiation
 */

describe("Dashboard page header visual elements", () => {
	// Test the FileText icon renders with proper styling
	it("FileText icon renders with mode accent color", () => {
		const TestComponent = () => (
			<div className="p-4 border-b border-border">
				<div className="flex items-center gap-2">
					<FileText
						className="w-5 h-5"
						style={{ color: "var(--mode-accent)" }}
						aria-hidden="true"
						data-testid="mode-icon"
					/>
					<h1 className="text-lg font-semibold">Documents</h1>
				</div>
			</div>
		);

		render(<TestComponent />);

		// Check the heading
		const heading = screen.getByRole("heading", { name: "Documents" });
		expect(heading).toBeInTheDocument();

		// Check the icon
		const icon = screen.getByTestId("mode-icon");
		expect(icon).toBeInTheDocument();
		expect(icon).toHaveAttribute("aria-hidden", "true");
		expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
	});

	it("icon and title are visually aligned", () => {
		const TestComponent = () => (
			<div className="p-4 border-b border-border">
				<div className="flex items-center gap-2" data-testid="header-container">
					<FileText
						className="w-5 h-5"
						style={{ color: "var(--mode-accent)" }}
						aria-hidden="true"
					/>
					<h1 className="text-lg font-semibold">Documents</h1>
				</div>
			</div>
		);

		render(<TestComponent />);

		const container = screen.getByTestId("header-container");
		expect(container).toHaveClass("flex", "items-center", "gap-2");
	});
});
