import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JournalComposer } from "../JournalComposer";

describe("JournalComposer", () => {
	it("shows the Quick Capture hotkey hint", () => {
		render(<JournalComposer onAdd={vi.fn()} hotkeyHint="Ctrl+Shift+N" />);
		expect(screen.getByText("Ctrl+Shift+N")).toBeInTheDocument();
	});

	it("hides the Quick Capture hint when hotkeyHint is null", () => {
		render(<JournalComposer onAdd={vi.fn()} hotkeyHint={null} />);
		expect(screen.queryByText("Quick Capture:")).not.toBeInTheDocument();
	});

	it("disables Add until there is text", () => {
		render(<JournalComposer onAdd={vi.fn()} hotkeyHint="Ctrl+Shift+N" />);
		expect(screen.getByRole("button", { name: "Add entry" })).toBeDisabled();

		fireEvent.change(screen.getByRole("textbox", { name: "Add journal entry" }), {
			target: { value: "Hello" },
		});
		expect(screen.getByRole("button", { name: "Add entry" })).toBeEnabled();
	});

	it("submits the text and clears the field", async () => {
		const onAdd = vi.fn().mockResolvedValue(undefined);
		render(<JournalComposer onAdd={onAdd} hotkeyHint="Ctrl+Shift+N" />);

		const textarea = screen.getByRole("textbox", { name: "Add journal entry" });
		fireEvent.change(textarea, { target: { value: "Buy milk #errand" } });
		fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

		await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Buy milk #errand"));
		await waitFor(() => expect(textarea).toHaveValue(""));
	});

	it("submits on Cmd/Ctrl+Enter", async () => {
		const onAdd = vi.fn().mockResolvedValue(undefined);
		render(<JournalComposer onAdd={onAdd} hotkeyHint="Ctrl+Shift+N" />);

		const textarea = screen.getByRole("textbox", { name: "Add journal entry" });
		fireEvent.change(textarea, { target: { value: "Quick note" } });
		fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

		await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Quick note"));
	});
});
