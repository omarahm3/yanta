import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JournalEntry } from "../JournalEntry";

const mockEntry = {
	id: "abc123",
	content: "Fix the auth bug",
	tags: ["urgent", "backend"],
	created: new Date("2026-01-30T09:15:00Z").toISOString(),
};

describe("JournalEntry mode-accent styling", () => {
	it("applies mode-accent styles to highlighted entry via inline styles", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isHighlighted />);

		const entry = screen.getByTestId("journal-entry");

		// Check that mode-accent CSS variable styles are applied
		expect(entry).toHaveStyle({
			borderLeftColor: "var(--mode-accent)",
			backgroundColor: "var(--mode-accent-muted)",
		});
	});

	it("applies mode-accent border style to selected entry", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isSelected />);

		const entry = screen.getByTestId("journal-entry");
		expect(entry).toHaveStyle({
			borderLeftColor: "var(--mode-accent)",
		});
	});

	it("applies mode-accent color to selection toggle button when selected", () => {
		render(
			<JournalEntry
				entry={mockEntry}
				index={0}
				onEntryClick={vi.fn()}
				onToggleSelection={vi.fn()}
				isSelected
			/>,
		);

		const toggle = screen.getByRole("button", { name: /deselect/i });
		expect(toggle).toHaveStyle({
			borderColor: "var(--mode-accent)",
			color: "var(--mode-accent)",
		});
	});

	it("applies mode-accent color to index number when highlighted", () => {
		const { container } = render(
			<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isHighlighted />,
		);

		// Find the index span (contains "1.")
		const indexSpan = container.querySelector("span.font-mono");
		expect(indexSpan).toHaveStyle({ color: "var(--mode-accent)" });
	});

	it("applies mode-accent color to index number when selected", () => {
		const { container } = render(
			<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isSelected />,
		);

		// Find the index span (contains "1.")
		const indexSpan = container.querySelector("span.font-mono");
		expect(indexSpan).toHaveStyle({
			color: "var(--mode-accent)",
			fontWeight: "bold",
		});
	});
});
