import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileIcon, FolderIcon, SettingsIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { type CommandOption, CommandPalette, type SubPaletteItem } from "../CommandPalette";

const mockCommands: CommandOption[] = [
	{
		id: "nav-dashboard",
		icon: <FolderIcon />,
		text: "Go to Dashboard",
		group: "Navigation",
		action: vi.fn(),
	},
	{
		id: "nav-settings",
		icon: <SettingsIcon />,
		text: "Go to Settings",
		shortcut: "Ctrl+,",
		group: "Navigation",
		action: vi.fn(),
	},
	{
		id: "new-document",
		icon: <FileIcon />,
		text: "New Document",
		shortcut: "Ctrl+N",
		group: "Create",
		action: vi.fn(),
	},
	{
		id: "git-sync",
		icon: <FileIcon />,
		text: "Git Sync",
		hint: "Push changes",
		group: "Git",
		action: vi.fn(),
	},
	{
		id: "no-group-command",
		icon: <FileIcon />,
		text: "Ungrouped Command",
		hint: "No group assigned",
		action: vi.fn(),
	},
];

describe("CommandPalette", () => {
	it("renders nothing when closed", () => {
		render(
			<CommandPalette
				isOpen={false}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={mockCommands}
			/>,
		);

		expect(screen.queryByPlaceholderText("Type a command...")).not.toBeInTheDocument();
	});

	it("renders command palette when open", () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={mockCommands}
			/>,
		);

		expect(screen.getByPlaceholderText("Type a command...")).toBeInTheDocument();
	});

	it("renders group headers for commands with groups", () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={mockCommands}
			/>,
		);

		expect(screen.getByText("Navigation")).toBeInTheDocument();
		expect(screen.getByText("Create")).toBeInTheDocument();
		expect(screen.getByText("Git")).toBeInTheDocument();
	});

	it("groups commands correctly under their group headers", () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={mockCommands}
			/>,
		);

		// Find Navigation group and verify its commands
		const navigationHeader = screen.getByText("Navigation");
		const navigationGroup = navigationHeader.closest('[data-slot="command-group"]');
		expect(navigationGroup).not.toBeNull();

		if (navigationGroup) {
			expect(within(navigationGroup as HTMLElement).getByText("Go to Dashboard")).toBeInTheDocument();
			expect(within(navigationGroup as HTMLElement).getByText("Go to Settings")).toBeInTheDocument();
		}

		// Find Create group and verify its commands
		const createHeader = screen.getByText("Create");
		const createGroup = createHeader.closest('[data-slot="command-group"]');
		expect(createGroup).not.toBeNull();

		if (createGroup) {
			expect(within(createGroup as HTMLElement).getByText("New Document")).toBeInTheDocument();
		}
	});

	it("places commands without groups in Other group", () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={mockCommands}
			/>,
		);

		expect(screen.getByText("Other")).toBeInTheDocument();
		const otherHeader = screen.getByText("Other");
		const otherGroup = otherHeader.closest('[data-slot="command-group"]');

		if (otherGroup) {
			expect(within(otherGroup as HTMLElement).getByText("Ungrouped Command")).toBeInTheDocument();
		}
	});

	it("renders shortcuts in kbd elements", () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={mockCommands}
			/>,
		);

		const shortcutElement = screen.getByText("Ctrl+N");
		expect(shortcutElement.tagName).toBe("KBD");
	});

	it("renders hints when no shortcut is provided", () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={mockCommands}
			/>,
		);

		expect(screen.getByText("Push changes")).toBeInTheDocument();
	});

	it("maintains group order: Navigation, Create, Document, Git, Projects, Application, Other", () => {
		const commandsWithAllGroups: CommandOption[] = [
			{ id: "app-1", icon: <FileIcon />, text: "App Command", group: "Application", action: vi.fn() },
			{
				id: "proj-1",
				icon: <FileIcon />,
				text: "Project Command",
				group: "Projects",
				action: vi.fn(),
			},
			{ id: "git-1", icon: <FileIcon />, text: "Git Command", group: "Git", action: vi.fn() },
			{ id: "doc-1", icon: <FileIcon />, text: "Doc Command", group: "Document", action: vi.fn() },
			{ id: "create-1", icon: <FileIcon />, text: "Create Command", group: "Create", action: vi.fn() },
			{ id: "nav-1", icon: <FileIcon />, text: "Nav Command", group: "Navigation", action: vi.fn() },
			{ id: "other-1", icon: <FileIcon />, text: "Other Command", action: vi.fn() },
		];

		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={commandsWithAllGroups}
			/>,
		);

		// Get all group headers in order
		const groups = screen.getAllByText(
			/^(Navigation|Create|Document|Git|Projects|Application|Other)$/,
		);
		const groupNames = groups.map((el) => el.textContent);

		// Verify order
		const expectedOrder = [
			"Navigation",
			"Create",
			"Document",
			"Git",
			"Projects",
			"Application",
			"Other",
		];
		expect(groupNames).toEqual(expectedOrder);
	});

	it("does not render empty groups", () => {
		const commandsNavOnly: CommandOption[] = [
			{ id: "nav-1", icon: <FileIcon />, text: "Nav Command", group: "Navigation", action: vi.fn() },
		];

		render(
			<CommandPalette
				isOpen={true}
				onClose={vi.fn()}
				onCommandSelect={vi.fn()}
				commands={commandsNavOnly}
			/>,
		);

		expect(screen.getByText("Navigation")).toBeInTheDocument();
		expect(screen.queryByText("Create")).not.toBeInTheDocument();
		expect(screen.queryByText("Git")).not.toBeInTheDocument();
		expect(screen.queryByText("Other")).not.toBeInTheDocument();
	});

	describe("keyword alias fuzzy search", () => {
		const commandsWithKeywords: CommandOption[] = [
			{
				id: "nav-dashboard",
				icon: <FolderIcon />,
				text: "Go to Dashboard",
				group: "Navigation",
				keywords: ["home", "main", "list", "documents"],
				action: vi.fn(),
			},
			{
				id: "nav-journal",
				icon: <FileIcon />,
				text: "Go to Journal",
				group: "Navigation",
				keywords: ["diary", "daily", "notes", "log"],
				action: vi.fn(),
			},
			{
				id: "nav-settings",
				icon: <SettingsIcon />,
				text: "Go to Settings",
				group: "Navigation",
				keywords: ["preferences", "config", "options"],
				action: vi.fn(),
			},
			{
				id: "git-sync",
				icon: <FileIcon />,
				text: "Git Sync",
				group: "Git",
				keywords: ["save", "backup", "commit", "push"],
				action: vi.fn(),
			},
		];

		it("includes keywords in the value prop for fuzzy matching", () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={commandsWithKeywords}
				/>,
			);

			// The CommandItem value should include both text and keywords
			// We can verify this by checking the data-value attribute on the command items
			const dashboardItem = screen.getByText("Go to Dashboard").closest('[data-slot="command-item"]');
			expect(dashboardItem).toHaveAttribute("data-value", "Go to Dashboard home main list documents");
		});

		it("renders commands with keywords correctly", () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={commandsWithKeywords}
				/>,
			);

			// Verify all commands render
			expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
			expect(screen.getByText("Go to Journal")).toBeInTheDocument();
			expect(screen.getByText("Go to Settings")).toBeInTheDocument();
			expect(screen.getByText("Git Sync")).toBeInTheDocument();
		});

		it("filters commands by keyword search", async () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={commandsWithKeywords}
				/>,
			);

			const input = screen.getByPlaceholderText("Type a command...");

			// Search by keyword "diary" which is only on nav-journal
			await userEvent.type(input, "diary");

			// Journal should be visible, others should be filtered out
			expect(screen.getByText("Go to Journal")).toBeInTheDocument();
			expect(screen.queryByText("Go to Dashboard")).not.toBeInTheDocument();
			expect(screen.queryByText("Go to Settings")).not.toBeInTheDocument();
			expect(screen.queryByText("Git Sync")).not.toBeInTheDocument();
		});

		it("filters commands by keyword 'save' for Git Sync", async () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={commandsWithKeywords}
				/>,
			);

			const input = screen.getByPlaceholderText("Type a command...");

			// Search by keyword "save" which is only on git-sync
			await userEvent.type(input, "save");

			// Git Sync should be visible
			expect(screen.getByText("Git Sync")).toBeInTheDocument();
			expect(screen.queryByText("Go to Dashboard")).not.toBeInTheDocument();
		});

		it("filters commands by keyword 'preferences' for Settings", async () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={commandsWithKeywords}
				/>,
			);

			const input = screen.getByPlaceholderText("Type a command...");

			// Search by keyword "preferences" which is only on nav-settings
			await userEvent.type(input, "preferences");

			// Settings should be visible
			expect(screen.getByText("Go to Settings")).toBeInTheDocument();
			expect(screen.queryByText("Go to Dashboard")).not.toBeInTheDocument();
		});

		it("still allows searching by command text", async () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={commandsWithKeywords}
				/>,
			);

			const input = screen.getByPlaceholderText("Type a command...");

			// Search by command text "Dashboard"
			await userEvent.type(input, "Dashboard");

			// Dashboard should be visible
			expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
			expect(screen.queryByText("Go to Journal")).not.toBeInTheDocument();
		});
	});

	describe("sub-palette mode", () => {
		const mockSubPaletteItems: SubPaletteItem[] = [
			{
				id: "recent-1",
				icon: <FileIcon />,
				text: "Recent Document 1",
				hint: "2 min ago",
				action: vi.fn(),
			},
			{
				id: "recent-2",
				icon: <FileIcon />,
				text: "Recent Document 2",
				hint: "yesterday",
				action: vi.fn(),
			},
		];

		it("renders sub-palette items when subPaletteItems is provided", () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={mockCommands}
					subPaletteItems={mockSubPaletteItems}
					subPaletteTitle="Recent Documents"
					onSubPaletteBack={vi.fn()}
				/>,
			);

			expect(screen.getByText("Recent Document 1")).toBeInTheDocument();
			expect(screen.getByText("Recent Document 2")).toBeInTheDocument();
			expect(screen.getByText("2 min ago")).toBeInTheDocument();
		});

		it("renders sub-palette title and back button", () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={mockCommands}
					subPaletteItems={mockSubPaletteItems}
					subPaletteTitle="Recent Documents"
					onSubPaletteBack={vi.fn()}
				/>,
			);

			expect(screen.getByText("Recent Documents")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
		});

		it("hides main commands when in sub-palette mode", () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={mockCommands}
					subPaletteItems={mockSubPaletteItems}
					subPaletteTitle="Recent Documents"
					onSubPaletteBack={vi.fn()}
				/>,
			);

			expect(screen.queryByText("Go to Dashboard")).not.toBeInTheDocument();
			expect(screen.queryByText("Go to Settings")).not.toBeInTheDocument();
		});

		it("calls onSubPaletteBack when back button is clicked", async () => {
			const onBackMock = vi.fn();
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={mockCommands}
					subPaletteItems={mockSubPaletteItems}
					subPaletteTitle="Recent Documents"
					onSubPaletteBack={onBackMock}
				/>,
			);

			const backButton = screen.getByRole("button", { name: "Go back" });
			await userEvent.click(backButton);

			expect(onBackMock).toHaveBeenCalledTimes(1);
		});

		it("calls action and onClose when sub-palette item is selected", async () => {
			const onCloseMock = vi.fn();
			const itemAction = vi.fn();
			const itemsWithAction: SubPaletteItem[] = [
				{
					id: "recent-1",
					text: "Recent Document 1",
					hint: "2 min ago",
					action: itemAction,
				},
			];

			render(
				<CommandPalette
					isOpen={true}
					onClose={onCloseMock}
					onCommandSelect={vi.fn()}
					commands={mockCommands}
					subPaletteItems={itemsWithAction}
					subPaletteTitle="Recent Documents"
					onSubPaletteBack={vi.fn()}
				/>,
			);

			const item = screen.getByText("Recent Document 1");
			await userEvent.click(item);

			expect(itemAction).toHaveBeenCalledTimes(1);
			expect(onCloseMock).toHaveBeenCalledTimes(1);
		});

		it("uses sub-palette specific placeholder", () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={mockCommands}
					subPaletteItems={mockSubPaletteItems}
					subPaletteTitle="Recent Documents"
					onSubPaletteBack={vi.fn()}
				/>,
			);

			expect(screen.getByPlaceholderText("Search recent documents...")).toBeInTheDocument();
		});

		it("filters sub-palette items by search", async () => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={vi.fn()}
					onCommandSelect={vi.fn()}
					commands={mockCommands}
					subPaletteItems={mockSubPaletteItems}
					subPaletteTitle="Recent Documents"
					onSubPaletteBack={vi.fn()}
				/>,
			);

			const input = screen.getByPlaceholderText("Search recent documents...");
			await userEvent.type(input, "Document 1");

			expect(screen.getByText("Recent Document 1")).toBeInTheDocument();
			expect(screen.queryByText("Recent Document 2")).not.toBeInTheDocument();
		});
	});
});
