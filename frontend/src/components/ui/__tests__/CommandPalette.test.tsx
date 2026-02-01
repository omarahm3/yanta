import { render, screen, within } from "@testing-library/react";
import { FileIcon, FolderIcon, SettingsIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette, type CommandOption } from "../CommandPalette";

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
			{ id: "proj-1", icon: <FileIcon />, text: "Project Command", group: "Projects", action: vi.fn() },
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
		const groups = screen.getAllByText(/^(Navigation|Create|Document|Git|Projects|Application|Other)$/);
		const groupNames = groups.map((el) => el.textContent);

		// Verify order
		const expectedOrder = ["Navigation", "Create", "Document", "Git", "Projects", "Application", "Other"];
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
});
