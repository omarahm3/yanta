import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectPicker } from "../ProjectPicker";

const mockProjects = [
	{ id: "1", alias: "personal", name: "Personal" },
	{ id: "2", alias: "work", name: "Work" },
	{ id: "3", alias: "ideas", name: "Ideas" },
];

describe("ProjectPicker", () => {
	it("shows current project", () => {
		render(<ProjectPicker projects={mockProjects} selectedAlias="personal" onSelect={vi.fn()} />);

		expect(screen.getByText("@personal")).toBeInTheDocument();
	});

	it("opens dropdown on click", () => {
		render(<ProjectPicker projects={mockProjects} selectedAlias="personal" onSelect={vi.fn()} />);

		const trigger = screen.getByRole("button");
		fireEvent.click(trigger);

		expect(screen.getByPlaceholderText("Search projects...")).toBeInTheDocument();
	});

	it("filters projects on type", async () => {
		render(<ProjectPicker projects={mockProjects} selectedAlias="personal" onSelect={vi.fn()} />);

		const trigger = screen.getByRole("button");
		fireEvent.click(trigger);

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.change(input, { target: { value: "wo" } });

		await waitFor(() => {
			expect(screen.getByText("@work")).toBeInTheDocument();
			expect(screen.queryByText("@ideas")).not.toBeInTheDocument();
		});
	});

	it("selects project on Enter", () => {
		const onSelect = vi.fn();
		render(<ProjectPicker projects={mockProjects} selectedAlias="personal" onSelect={onSelect} />);

		const trigger = screen.getByRole("button");
		fireEvent.click(trigger);

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.keyDown(input, { key: "Enter" });

		expect(onSelect).toHaveBeenCalled();
	});

	it("navigates with arrow keys", () => {
		render(<ProjectPicker projects={mockProjects} selectedAlias="personal" onSelect={vi.fn()} />);

		const trigger = screen.getByRole("button");
		fireEvent.click(trigger);

		const input = screen.getByPlaceholderText("Search projects...");

		// Initially first item (index 0) is highlighted
		const items = screen.getAllByRole("option");
		expect(items[0]).toHaveAttribute("data-highlighted", "true");

		// Navigate down once - should highlight second item (index 1)
		fireEvent.keyDown(input, { key: "ArrowDown" });
		expect(items[1]).toHaveAttribute("data-highlighted", "true");
	});

	it("closes on Escape", () => {
		render(<ProjectPicker projects={mockProjects} selectedAlias="personal" onSelect={vi.fn()} />);

		const trigger = screen.getByRole("button");
		fireEvent.click(trigger);

		expect(screen.getByPlaceholderText("Search projects...")).toBeInTheDocument();

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.keyDown(input, { key: "Escape" });

		expect(screen.queryByPlaceholderText("Search projects...")).not.toBeInTheDocument();
	});

	it("shows dropdown indicator", () => {
		render(<ProjectPicker projects={mockProjects} selectedAlias="personal" onSelect={vi.fn()} />);

		expect(screen.getByText("▾")).toBeInTheDocument();
	});

	it("handles empty projects list", () => {
		render(<ProjectPicker projects={[]} selectedAlias={null} onSelect={vi.fn()} />);

		const trigger = screen.getByRole("button");
		fireEvent.click(trigger);

		expect(screen.getByText(/no projects/i)).toBeInTheDocument();
	});
});
