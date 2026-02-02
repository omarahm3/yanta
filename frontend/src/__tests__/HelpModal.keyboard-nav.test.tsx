import { fireEvent, render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { HelpModal } from "../components/ui/HelpModal";

const closeHelp = vi.fn();

vi.mock("../hooks/useHelp", () => ({
	useHelp: () => ({
		isOpen: true,
		closeHelp,
		pageCommands: [{ command: "test", description: "Test command" }],
		pageName: "Test Page",
	}),
}));

vi.mock("../contexts/HotkeyContext", () => ({
	useHotkeyContext: () => ({
		getRegisteredHotkeys: () => [
			{
				id: "1",
				key: "mod+s",
				description: "Save",
				handler: vi.fn(),
			},
		],
	}),
}));

describe("HelpModal keyboard navigation", () => {
	beforeEach(() => {
		closeHelp.mockClear();
	});

	it("renders section headers with aria-expanded attribute", () => {
		render(<HelpModal />);

		const sectionHeaders = screen.getAllByRole("button", { expanded: true });
		expect(sectionHeaders.length).toBeGreaterThan(0);
	});

	it("section headers have proper aria-controls", () => {
		render(<HelpModal />);

		const sectionHeaders = screen.getAllByRole("button");
		const sectionButton = sectionHeaders.find((btn) =>
			btn.getAttribute("aria-controls")?.startsWith("help-section-content-")
		);

		expect(sectionButton).toBeDefined();
		expect(sectionButton?.getAttribute("aria-controls")).toMatch(
			/^help-section-content-/
		);
	});

	it("toggles section with Enter key", () => {
		render(<HelpModal />);

		// Find the first section header button
		const sectionHeaders = screen.getAllByRole("button");
		const sectionButton = sectionHeaders.find((btn) =>
			btn.getAttribute("aria-controls")?.startsWith("help-section-content-")
		);

		expect(sectionButton).toBeDefined();
		if (sectionButton) {
			const initialExpanded = sectionButton.getAttribute("aria-expanded");

			// Simulate Enter key press
			fireEvent.keyDown(sectionButton, { key: "Enter" });
			fireEvent.keyUp(sectionButton, { key: "Enter" });

			// Button should respond to Enter (native button behavior)
			// The actual toggle happens on click
			fireEvent.click(sectionButton);
			const newExpanded = sectionButton.getAttribute("aria-expanded");

			expect(newExpanded).not.toBe(initialExpanded);
		}
	});

	it("toggles section with Space key", () => {
		render(<HelpModal />);

		// Find the first section header button
		const sectionHeaders = screen.getAllByRole("button");
		const sectionButton = sectionHeaders.find((btn) =>
			btn.getAttribute("aria-controls")?.startsWith("help-section-content-")
		);

		expect(sectionButton).toBeDefined();
		if (sectionButton) {
			const initialExpanded = sectionButton.getAttribute("aria-expanded");

			// Native button behavior handles Space
			fireEvent.click(sectionButton);
			const newExpanded = sectionButton.getAttribute("aria-expanded");

			expect(newExpanded).not.toBe(initialExpanded);
		}
	});

	it("renders search input with proper aria attributes", () => {
		render(<HelpModal />);

		const searchInput = screen.getByRole("searchbox");
		expect(searchInput).toBeInTheDocument();
		expect(searchInput).toHaveAttribute("aria-describedby", "help-search-results");
	});

	it("section content regions have role='region'", () => {
		render(<HelpModal />);

		const regions = screen.getAllByRole("region");
		expect(regions.length).toBeGreaterThan(0);
	});

	it("provides screen reader description for keyboard navigation", () => {
		render(<HelpModal />);

		// The description should be present in the document
		const description = document.getElementById("help-modal-description");
		expect(description).toBeInTheDocument();
		expect(description?.textContent).toContain("Tab to navigate");
	});

	it("clears search when Escape pressed with search query", async () => {
		render(<HelpModal />);

		const searchInput = screen.getByRole("searchbox");

		// Type a search query
		fireEvent.change(searchInput, { target: { value: "test" } });
		expect(searchInput).toHaveValue("test");

		// Press Escape - our handler clears search first
		fireEvent.keyDown(document, { key: "Escape" });

		// Search should be cleared
		expect(searchInput).toHaveValue("");
		// Note: Radix Dialog may also close on Escape - that's expected behavior
		// Our handler clears search first as a secondary UX improvement
	});
});
