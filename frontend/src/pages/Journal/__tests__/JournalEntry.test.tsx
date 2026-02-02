import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JournalEntry } from "../JournalEntry";

const mockEntry = {
	id: "abc123",
	content: "Fix the auth bug",
	tags: ["urgent", "backend"],
	created: new Date("2026-01-30T09:15:00Z").toISOString(),
};

describe("JournalEntry", () => {
	it("renders entry content", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} />);

		expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
	});

	it("renders tags", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} />);

		expect(screen.getByText("#urgent")).toBeInTheDocument();
		expect(screen.getByText("#backend")).toBeInTheDocument();
	});

	it("renders timestamp", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} />);

		// Should show a time (format depends on locale/timezone)
		expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
	});

	it("renders index number", () => {
		render(<JournalEntry entry={mockEntry} index={2} onEntryClick={vi.fn()} />);

		expect(screen.getByText("3.")).toBeInTheDocument();
	});

	it("calls onEntryClick when content clicked", () => {
		const onEntryClick = vi.fn();
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={onEntryClick} />);

		const content = screen.getByText("Fix the auth bug");
		fireEvent.click(content);

		expect(onEntryClick).toHaveBeenCalledWith("abc123");
	});

	it("renders entry without tags", () => {
		const entryNoTags = { ...mockEntry, tags: [] };
		render(<JournalEntry entry={entryNoTags} index={0} onEntryClick={vi.fn()} />);

		expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		expect(screen.queryByText("#")).not.toBeInTheDocument();
	});

	it("shows selection toggle button", () => {
		render(
			<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} onToggleSelection={vi.fn()} />,
		);

		expect(screen.getByRole("button", { name: /select/i })).toBeInTheDocument();
	});

	it("calls onToggleSelection when toggle clicked", () => {
		const onToggleSelection = vi.fn();
		render(
			<JournalEntry
				entry={mockEntry}
				index={0}
				onEntryClick={vi.fn()}
				onToggleSelection={onToggleSelection}
			/>,
		);

		const toggleButton = screen.getByRole("button", { name: /select/i });
		fireEvent.click(toggleButton);

		expect(onToggleSelection).toHaveBeenCalledWith("abc123");
	});

	it("shows checkmark when selected", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isSelected />);

		expect(screen.getByText("✓")).toBeInTheDocument();
	});

	it("applies highlighted styling via mode-accent CSS variables", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isHighlighted />);

		const entry = screen.getByTestId("journal-entry");
		// Now uses mode-accent CSS variables for border and background
		expect(entry).toHaveStyle({
			borderLeftColor: "var(--mode-accent)",
			backgroundColor: "var(--mode-accent-muted)",
		});
	});

	it("applies selected styling via mode-accent CSS variable", () => {
		render(<JournalEntry entry={mockEntry} index={0} onEntryClick={vi.fn()} isSelected />);

		const entry = screen.getByTestId("journal-entry");
		// Now uses mode-accent CSS variable for border color
		expect(entry).toHaveStyle({
			borderLeftColor: "var(--mode-accent)",
		});
	});

	it("renders project alias when present", () => {
		const entryWithProject = { ...mockEntry, projectAlias: "@work" };
		render(<JournalEntry entry={entryWithProject} index={0} onEntryClick={vi.fn()} />);

		expect(screen.getByText("@work")).toBeInTheDocument();
	});
});
