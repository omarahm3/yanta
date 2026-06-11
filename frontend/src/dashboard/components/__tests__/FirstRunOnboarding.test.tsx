import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstRunOnboarding } from "../FirstRunOnboarding";

describe("FirstRunOnboarding", () => {
	it("renders a welcoming guided state instead of a blank screen", () => {
		render(<FirstRunOnboarding onCreateNote={vi.fn()} onCreateProject={vi.fn()} />);

		expect(screen.getByRole("heading", { name: /welcome to yanta/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /create your first note/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /set up a project/i })).toBeInTheDocument();
		expect(screen.getByText(/command palette/i)).toBeInTheDocument();
	});

	it("invokes onCreateNote when the primary action is clicked", () => {
		const onCreateNote = vi.fn();
		render(<FirstRunOnboarding onCreateNote={onCreateNote} onCreateProject={vi.fn()} />);

		fireEvent.click(screen.getByRole("button", { name: /create your first note/i }));

		expect(onCreateNote).toHaveBeenCalledTimes(1);
	});

	it("invokes onCreateProject when the secondary action is clicked", () => {
		const onCreateProject = vi.fn();
		render(<FirstRunOnboarding onCreateNote={vi.fn()} onCreateProject={onCreateProject} />);

		fireEvent.click(screen.getByRole("button", { name: /set up a project/i }));

		expect(onCreateProject).toHaveBeenCalledTimes(1);
	});

	it("disables actions and shows progress while creating", () => {
		const onCreateNote = vi.fn();
		render(
			<FirstRunOnboarding onCreateNote={onCreateNote} onCreateProject={vi.fn()} isCreating />,
		);

		const primary = screen.getByRole("button", { name: /creating/i });
		expect(primary).toBeDisabled();
		fireEvent.click(primary);
		expect(onCreateNote).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: /set up a project/i })).toBeDisabled();
	});
});
