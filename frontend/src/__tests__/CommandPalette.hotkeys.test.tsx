import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Helper to get options from the dialog (handles Radix portal)
const getOptions = () => document.body.querySelectorAll('[role="option"]');

// Helper to get the cmdk input element
const getCmdkInput = () => document.body.querySelector('[data-slot="command-input"]') as HTMLInputElement;

describe("CommandPalette hotkeys", () => {
	beforeEach(() => {
		onClose.mockClear();
		onCommandSelect.mockClear();
		mockCommands.forEach((cmd) => vi.mocked(cmd.action).mockClear());
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
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");

		// First item should be selected by default
		await waitFor(() => {
			const options = getOptions();
			expect(options[0]).toHaveAttribute("data-selected", "true");
		});

		fireEvent.keyDown(document, { key: "n", ctrlKey: true });

		await waitFor(() => {
			const options = getOptions();
			expect(options[1]).toHaveAttribute("data-selected", "true");
		});
	});

	it("navigates up with Ctrl+P", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");

		// Navigate down first
		fireEvent.keyDown(document, { key: "n", ctrlKey: true });
		await waitFor(() => {
			const options = getOptions();
			expect(options[1]).toHaveAttribute("data-selected", "true");
		});

		// Navigate back up
		fireEvent.keyDown(document, { key: "p", ctrlKey: true });
		await waitFor(() => {
			const options = getOptions();
			expect(options[0]).toHaveAttribute("data-selected", "true");
		});
	});

	it("navigates down with ArrowDown", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");
		const input = getCmdkInput();
		expect(input).toBeTruthy();

		// First item should be selected by default
		await waitFor(() => {
			const options = getOptions();
			expect(options[0]).toHaveAttribute("data-selected", "true");
		});

		// Fire ArrowDown on the cmdk input
		fireEvent.keyDown(input, { key: "ArrowDown" });

		await waitFor(() => {
			const options = getOptions();
			expect(options[1]).toHaveAttribute("data-selected", "true");
		});
	});

	it("navigates up with ArrowUp", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("New Document");
		const input = getCmdkInput();

		// Navigate down first
		fireEvent.keyDown(input, { key: "ArrowDown" });
		await waitFor(() => {
			const options = getOptions();
			expect(options[1]).toHaveAttribute("data-selected", "true");
		});

		// Navigate back up
		fireEvent.keyDown(input, { key: "ArrowUp" });
		await waitFor(() => {
			const options = getOptions();
			expect(options[0]).toHaveAttribute("data-selected", "true");
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
		const input = getCmdkInput();

		// Ensure first item is selected
		await waitFor(() => {
			const options = getOptions();
			expect(options[0]).toHaveAttribute("data-selected", "true");
		});

		// Fire Enter on the cmdk input
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => {
			expect(mockCommands[0].action).toHaveBeenCalledTimes(1);
			expect(onCommandSelect).toHaveBeenCalledWith(mockCommands[0]);
			expect(onClose).toHaveBeenCalledTimes(1);
		});
	});

	it("wraps navigation at boundaries", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={mockCommands}
			/>,
		);

		await screen.findByText("Settings");
		const input = getCmdkInput();

		// First item should be selected by default
		await waitFor(() => {
			const options = getOptions();
			expect(options[0]).toHaveAttribute("data-selected", "true");
		});

		// Navigate up from first item should wrap to last (using Ctrl+P which triggers ArrowUp)
		fireEvent.keyDown(document, { key: "p", ctrlKey: true });
		await waitFor(() => {
			const options = getOptions();
			expect(options[2]).toHaveAttribute("data-selected", "true");
		});

		// Navigate down from last item should wrap to first
		fireEvent.keyDown(input, { key: "ArrowDown" });
		await waitFor(() => {
			const options = getOptions();
			expect(options[0]).toHaveAttribute("data-selected", "true");
		});
	});
});
