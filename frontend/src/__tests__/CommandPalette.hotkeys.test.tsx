import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { type CommandOption, CommandPalette } from "../components/ui/CommandPalette";

Element.prototype.scrollIntoView = vi.fn();

const onClose = vi.fn();
const onCommandSelect = vi.fn();

const mockCommands: CommandOption[] = [
	{
		id: "1",
		icon: <span>📄</span>,
		text: "New Document",
		action: vi.fn(),
	},
	{
		id: "2",
		icon: <span>🔍</span>,
		text: "Search",
		action: vi.fn(),
	},
	{
		id: "3",
		icon: <span>⚙️</span>,
		text: "Settings",
		action: vi.fn(),
	},
];

describe("CommandPalette hotkeys", () => {
	beforeEach(() => {
		onClose.mockClear();
		onCommandSelect.mockClear();
		mockCommands.forEach((cmd) => (cmd.action as any).mockClear());
	});

	it("closes with Escape", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("navigates down with Ctrl+N", async () => {
		const { container } = render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");
		let options = container.querySelectorAll('[role="option"]');
		expect(options[0]).toHaveClass("bg-border");

		fireEvent.keyDown(document, { key: "n", ctrlKey: true });

		await waitFor(() => {
			options = container.querySelectorAll('[role="option"]');
			expect(options[1]).toHaveClass("bg-border");
		});
	});

	it("navigates up with Ctrl+P", async () => {
		const { container } = render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");
		fireEvent.keyDown(document, { key: "n", ctrlKey: true });
		await waitFor(() => {
			const options = container.querySelectorAll('[role="option"]');
			expect(options[1]).toHaveClass("bg-border");
		});

		fireEvent.keyDown(document, { key: "p", ctrlKey: true });
		await waitFor(() => {
			const options = container.querySelectorAll('[role="option"]');
			expect(options[0]).toHaveClass("bg-border");
		});
	});

	it("navigates down with ArrowDown", async () => {
		const { container } = render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");
		let options = container.querySelectorAll('[role="option"]');
		expect(options[0]).toHaveClass("bg-border");

		fireEvent.keyDown(document, { key: "ArrowDown" });

		await waitFor(() => {
			options = container.querySelectorAll('[role="option"]');
			expect(options[1]).toHaveClass("bg-border");
		});
	});

	it("navigates up with ArrowUp", async () => {
		const { container } = render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");
		fireEvent.keyDown(document, { key: "ArrowDown" });
		await waitFor(() => {
			const options = container.querySelectorAll('[role="option"]');
			expect(options[1]).toHaveClass("bg-border");
		});

		fireEvent.keyDown(document, { key: "ArrowUp" });
		await waitFor(() => {
			const options = container.querySelectorAll('[role="option"]');
			expect(options[0]).toHaveClass("bg-border");
		});
	});

	it("executes command with Enter", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");

		fireEvent.keyDown(document, { key: "Enter" });

		await waitFor(() => {
			expect(mockCommands[0].action).toHaveBeenCalledTimes(1);
			expect(onCommandSelect).toHaveBeenCalledWith(mockCommands[0]);
			expect(onClose).toHaveBeenCalledTimes(1);
		});
	});

	it("wraps navigation at boundaries", async () => {
		const { container } = render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("Settings");
		fireEvent.keyDown(document, { key: "p", ctrlKey: true });
		await waitFor(() => {
			const options = container.querySelectorAll('[role="option"]');
			expect(options[2]).toHaveClass("bg-border");
		});

		fireEvent.keyDown(document, { key: "ArrowDown" });
		await waitFor(() => {
			const options = container.querySelectorAll('[role="option"]');
			expect(options[0]).toHaveClass("bg-border");
		});
	});
});
