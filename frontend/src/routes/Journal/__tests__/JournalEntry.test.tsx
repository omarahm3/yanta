import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
		render(
			<JournalEntry entry={mockEntry} onDelete={vi.fn()} onEdit={vi.fn()} />
		);

		expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
	});

	it("renders tags", () => {
		render(
			<JournalEntry entry={mockEntry} onDelete={vi.fn()} onEdit={vi.fn()} />
		);

		expect(screen.getByText("#urgent")).toBeInTheDocument();
		expect(screen.getByText("#backend")).toBeInTheDocument();
	});

	it("renders timestamp", () => {
		render(
			<JournalEntry entry={mockEntry} onDelete={vi.fn()} onEdit={vi.fn()} />
		);

		// Should show a time (format depends on locale/timezone)
		// The output is "10:15 AM" or similar depending on environment
		expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
	});

	it("expands on click for edit", () => {
		const onEdit = vi.fn();
		render(
			<JournalEntry entry={mockEntry} onDelete={vi.fn()} onEdit={onEdit} />
		);

		const content = screen.getByText("Fix the auth bug");
		fireEvent.click(content);

		expect(onEdit).toHaveBeenCalledWith(mockEntry);
	});

	it("shows delete button on hover", () => {
		render(
			<JournalEntry entry={mockEntry} onDelete={vi.fn()} onEdit={vi.fn()} />
		);

		const entry = screen.getByTestId("journal-entry");

		// Delete button should be hidden initially (opacity-0)
		const deleteButton = screen.getByRole("button", { name: /delete/i });
		expect(deleteButton).toHaveClass("opacity-0");

		// On hover, delete button becomes visible
		fireEvent.mouseEnter(entry);
		expect(deleteButton).toHaveClass("group-hover:opacity-100");
	});

	it("calls onDelete with entry id", () => {
		const onDelete = vi.fn();
		render(
			<JournalEntry entry={mockEntry} onDelete={onDelete} onEdit={vi.fn()} />
		);

		const deleteButton = screen.getByRole("button", { name: /delete/i });
		fireEvent.click(deleteButton);

		expect(onDelete).toHaveBeenCalledWith("abc123");
	});

	it("renders entry without tags", () => {
		const entryNoTags = { ...mockEntry, tags: [] };
		render(
			<JournalEntry entry={entryNoTags} onDelete={vi.fn()} onEdit={vi.fn()} />
		);

		expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		expect(screen.queryByText("#")).not.toBeInTheDocument();
	});

	it("handles selected state", () => {
		render(
			<JournalEntry
				entry={mockEntry}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				isSelected
			/>
		);

		const entry = screen.getByTestId("journal-entry");
		expect(entry).toHaveClass("border-[#61AFEF]");
	});

	it("handles checkbox selection", () => {
		const onSelect = vi.fn();
		render(
			<JournalEntry
				entry={mockEntry}
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				onSelect={onSelect}
				showCheckbox
			/>
		);

		const checkbox = screen.getByRole("checkbox");
		fireEvent.click(checkbox);

		expect(onSelect).toHaveBeenCalledWith("abc123", true);
	});
});
