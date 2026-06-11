/**
 * Command Palette Quick-Switcher Tests (YANA-48)
 *
 * Tests for:
 * - Recent Actions group rendered at top of palette
 * - Notes group rendered with note search results
 * - onSearchChange callback fires when user types
 * - onNoteSelect callback fires when note is selected
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandOption, NoteResult } from "../shared/ui/CommandPalette";
import { CommandPalette } from "../shared/ui/CommandPalette";

// Polyfill scrollIntoView for JSDOM
Element.prototype.scrollIntoView = () => {};

const createMockCommands = (): CommandOption[] => [
	{
		id: "nav-dashboard",
		icon: <span>🏠</span>,
		text: "Go to Documents",
		hint: "Home",
		group: "Navigation",
		action: vi.fn(),
	},
	{
		id: "nav-search",
		icon: <span>🔍</span>,
		text: "Go to Search",
		group: "Navigation",
		action: vi.fn(),
	},
	{
		id: "new-document",
		icon: <span>📄</span>,
		text: "New Document",
		group: "Create",
		action: vi.fn(),
	},
];

const createMockNoteResults = (): NoteResult[] => [
	{
		path: "vault/project-a/meeting-notes.md",
		title: "Meeting Notes",
		projectAlias: "project-a",
		type: "document",
	},
	{
		path: "vault/project-b/ideas.md",
		title: "Ideas & Brainstorm",
		projectAlias: "project-b",
		type: "document",
	},
];

describe("Command Palette — Recent Actions Group", () => {
	let onClose: ReturnType<typeof vi.fn>;
	let onCommandSelect: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onClose = vi.fn();
		onCommandSelect = vi.fn();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders a Recent group when recentCommands are provided", async () => {
		const commands = createMockCommands();
		const recentCommands = [commands[0]];

		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={commands}
				recentCommands={recentCommands}
			/>,
		);

		await waitFor(() => {
			const headings = document.body.querySelectorAll("[cmdk-group-heading]");
			const headingTexts = Array.from(headings).map((h) => h.textContent);
			expect(headingTexts).toContain("Recent");
		});
	});

	it("does not render a Recent group when recentCommands is empty", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={createMockCommands()}
				recentCommands={[]}
			/>,
		);

		await waitFor(() => {
			const headings = document.body.querySelectorAll("[cmdk-group-heading]");
			const headingTexts = Array.from(headings).map((h) => h.textContent);
			expect(headingTexts).not.toContain("Recent");
		});
	});

	it("does not render a Recent group when recentCommands is not provided", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={createMockCommands()}
			/>,
		);

		await waitFor(() => {
			const headings = document.body.querySelectorAll("[cmdk-group-heading]");
			const headingTexts = Array.from(headings).map((h) => h.textContent);
			expect(headingTexts).not.toContain("Recent");
		});
	});

	it("renders Recent group before Navigation group", async () => {
		const commands = createMockCommands();
		const recentCommands = [commands[0]];

		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={commands}
				recentCommands={recentCommands}
			/>,
		);

		await waitFor(() => {
			const headings = document.body.querySelectorAll("[cmdk-group-heading]");
			const headingTexts = Array.from(headings).map((h) => h.textContent);
			const recentIdx = headingTexts.indexOf("Recent");
			const navIdx = headingTexts.indexOf("Navigation");
			expect(recentIdx).toBeGreaterThanOrEqual(0);
			expect(navIdx).toBeGreaterThanOrEqual(0);
			expect(recentIdx).toBeLessThan(navIdx);
		});
	});

	it("executes command from Recent group and closes palette", async () => {
		const commands = createMockCommands();
		const recentCommands = [{ ...commands[0], action: vi.fn() }];

		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={commands}
				recentCommands={recentCommands}
			/>,
		);

		await waitFor(() => {
			const headings = document.body.querySelectorAll("[cmdk-group-heading]");
			const headingTexts = Array.from(headings).map((h) => h.textContent);
			expect(headingTexts).toContain("Recent");
		});

		const input = document.body.querySelector('[data-slot="command-input"]') as HTMLInputElement;
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => {
			expect(onCommandSelect).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		});
	});
});

describe("Command Palette — Notes Quick-Switcher Group", () => {
	let onClose: ReturnType<typeof vi.fn>;
	let onCommandSelect: ReturnType<typeof vi.fn>;
	let onNoteSelect: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onClose = vi.fn();
		onCommandSelect = vi.fn();
		onNoteSelect = vi.fn();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders Notes group when noteResults are provided", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={createMockCommands()}
				noteResults={createMockNoteResults()}
				onNoteSelect={onNoteSelect}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
			expect(screen.getByText("Ideas & Brainstorm")).toBeInTheDocument();
		});

		const headings = document.body.querySelectorAll("[cmdk-group-heading]");
		const headingTexts = Array.from(headings).map((h) => h.textContent);
		expect(headingTexts).toContain("Notes");
	});

	it("does not render Notes group when noteResults is empty", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={createMockCommands()}
				noteResults={[]}
				onNoteSelect={onNoteSelect}
			/>,
		);

		await waitFor(() => {
			const headings = document.body.querySelectorAll("[cmdk-group-heading]");
			const headingTexts = Array.from(headings).map((h) => h.textContent);
			expect(headingTexts).not.toContain("Notes");
		});
	});

	it("calls onNoteSelect when a note is selected", async () => {
		const noteResults = createMockNoteResults();

		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={createMockCommands()}
				noteResults={noteResults}
				onNoteSelect={onNoteSelect}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
		});

		const noteItem = screen.getByText("Meeting Notes").closest('[role="option"]');
		if (noteItem) {
			fireEvent.click(noteItem);
		}

		await waitFor(() => {
			expect(onNoteSelect).toHaveBeenCalledWith(noteResults[0]);
			expect(onClose).toHaveBeenCalled();
		});
	});

	it("shows project alias as hint on each note result", async () => {
		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={createMockCommands()}
				noteResults={createMockNoteResults()}
				onNoteSelect={onNoteSelect}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByText("project-a")).toBeInTheDocument();
			expect(screen.getByText("project-b")).toBeInTheDocument();
		});
	});
});

describe("Command Palette — onSearchChange callback", () => {
	it("calls onSearchChange when user types in the input", async () => {
		const onSearchChange = vi.fn();
		const onClose = vi.fn();
		const onCommandSelect = vi.fn();

		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={createMockCommands()}
				onSearchChange={onSearchChange}
			/>,
		);

		const input = document.body.querySelector('[data-slot="command-input"]') as HTMLInputElement;
		await userEvent.type(input, "meet");

		await waitFor(() => {
			expect(onSearchChange).toHaveBeenCalledWith("meet");
		});
	});

	it("does not error when onSearchChange is not provided", async () => {
		const onClose = vi.fn();
		const onCommandSelect = vi.fn();

		expect(() => {
			render(
				<CommandPalette
					isOpen={true}
					onClose={onClose}
					onCommandSelect={onCommandSelect}
					commands={createMockCommands()}
				/>,
			);
		}).not.toThrow();
	});
});

describe("Command Palette — searching notes loading state", () => {
	it("shows searching indicator in empty state when isSearchingNotes is true", async () => {
		const onClose = vi.fn();
		const onCommandSelect = vi.fn();

		render(
			<CommandPalette
				isOpen={true}
				onClose={onClose}
				onCommandSelect={onCommandSelect}
				commands={[]}
				isSearchingNotes={true}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByText("Searching notes…")).toBeInTheDocument();
		});
	});
});
