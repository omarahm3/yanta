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
	it("applies highlighted state to highlighted entry via data attribute", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isHighlighted />);

		const entry = screen.getByTestId("journal-entry");

		// Check highlighted state via data attribute
		expect(entry).toHaveAttribute("data-highlighted", "true");
	});

	it("applies selected state to selected entry via data attribute", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isSelected />);

		const entry = screen.getByTestId("journal-entry");
		expect(entry).toHaveAttribute("data-selected", "true");
		expect(entry).toHaveAttribute("aria-selected", "true");
	});

	it("applies selected state to selection toggle button when selected", () => {
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
		expect(toggle).toHaveAttribute("data-selected", "true");
		expect(toggle).toHaveAttribute("aria-pressed", "true");
	});

	it("renders index number with font-mono class when highlighted", () => {
		const { container } = render(
			<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isHighlighted />,
		);

		// Find the index span (contains "1.")
		const indexSpan = container.querySelector("span.font-mono");
		expect(indexSpan).toBeInTheDocument();
		expect(indexSpan).toHaveTextContent("1.");
	});

	it("renders index number with font-mono class when selected", () => {
		const { container } = render(
			<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isSelected />,
		);

		// Find the index span (contains "1.")
		const indexSpan = container.querySelector("span.font-mono");
		expect(indexSpan).toBeInTheDocument();
		expect(indexSpan).toHaveTextContent("1.");
	});
});
