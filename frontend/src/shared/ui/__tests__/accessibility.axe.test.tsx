import { act, render, screen, waitFor } from "@testing-library/react";
import type { AxeResults } from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DialogProvider } from "../../../app/context";
import { MoveDocumentDialog } from "../../../dashboard/components/MoveDocumentDialog";
import { HelpModal } from "../../../help/components/HelpModal";
import { useErrorDialogStore } from "../../stores/errorDialog.store";
import type { ParsedGitError } from "../../utils/gitErrorParser";
import { Button } from "../Button";
import { type CommandOption, CommandPalette } from "../CommandPalette";
import { ConfirmDialog } from "../ConfirmDialog";
import { GlobalErrorDialog } from "../GlobalErrorDialog";
import { Input } from "../Input";
import { MigrationConflictDialog } from "../MigrationConflictDialog";
import { Modal } from "../Modal";
import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "../toast-primitives";

vi.mock("../../../shared/stores/dialog.store", () => ({
	useDialog: () => ({
		isDialogOpen: false,
		openDialog: vi.fn(),
		closeDialog: vi.fn(),
	}),
}));

vi.mock("../../../project", () => ({
	useProjectContext: () => ({
		projects: [
			{
				id: "project-alpha",
				name: "Alpha Project",
				alias: "@alpha",
				startDate: "",
				createdAt: "",
				updatedAt: "",
			},
			{
				id: "project-current",
				name: "Current Project",
				alias: "@current",
				startDate: "",
				createdAt: "",
				updatedAt: "",
			},
		],
		currentProject: null,
		isLoading: false,
		archivedProjects: [],
		loadProjects: vi.fn(),
		setCurrentProject: vi.fn(),
		previousProject: undefined,
		switchToLastProject: vi.fn(),
	}),
}));

vi.mock("../../../shared/services/DocumentService", () => ({
	moveDocumentToProject: vi.fn(),
}));

vi.mock("../../../help/hooks", () => ({
	useHelpModalController: () => ({
		isOpen: true,
		closeHelp: vi.fn(),
		pageName: "Documents",
		searchQuery: "",
		setSearchQuery: vi.fn(),
		expandedSections: new Set(["global", "documents"]),
		toggleSection: vi.fn(),
		announcement: "",
		searchInputRef: { current: null },
		closeButtonRef: { current: null },
		filteredSections: [
			{
				id: "global",
				title: "Global Shortcuts",
				shortcuts: [{ key: "Mod+K", description: "Command palette" }],
			},
		],
		filteredGlobalCommands: [],
		filteredPageCommands: [{ command: "new", description: "Create a document" }],
		hasSearchQuery: false,
		totalResults: 1,
		handleOpenChange: vi.fn(),
		handleClearSearch: vi.fn(),
	}),
}));

// jsdom cannot lay out or paint, so axe's color-contrast and target-size rules
// are not assessable here — those are checked manually/in-browser. We gate on
// the structural a11y rules (roles, accessible names, ARIA) that jsdom *can*
// evaluate, and fail on any critical or serious violation, matching the
// acceptance criterion "axe shows no critical violations".
const AXE_OPTIONS = {
	rules: {
		"color-contrast": { enabled: false },
		"target-size": { enabled: false },
	},
} as const;

function criticalOrSerious(results: AxeResults) {
	return results.violations
		.filter((v) => v.impact === "critical" || v.impact === "serious")
		.map((v) => `${v.id}: ${v.help}`);
}

describe("accessibility baseline (axe)", () => {
	afterEach(() => {
		useErrorDialogStore.getState().reset();
	});

	it("command palette has no critical/serious violations", async () => {
		const commands: CommandOption[] = [
			{ id: "new-doc", icon: null, text: "New Document", group: "Create", action: () => {} },
			{
				id: "open-settings",
				icon: null,
				text: "Open Settings",
				group: "Application",
				action: () => {},
			},
		];

		render(
			<CommandPalette
				isOpen
				onClose={() => {}}
				onCommandSelect={() => {}}
				commands={commands}
				placeholder="Type a command or search..."
			/>,
		);

		const dialog = await screen.findByRole("dialog");
		expect(criticalOrSerious(await axe(dialog, AXE_OPTIONS))).toEqual([]);
	});

	it("confirm dialog has no critical/serious violations", async () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen
					title="Delete project"
					message="This cannot be undone."
					onConfirm={() => {}}
					onCancel={() => {}}
					danger
					showCheckbox
				/>
			</DialogProvider>,
		);

		const dialog = await screen.findByRole("dialog");
		expect(criticalOrSerious(await axe(dialog, AXE_OPTIONS))).toEqual([]);
	});

	it("git error dialog has no critical/serious violations", async () => {
		const error: ParsedGitError = {
			type: "CONFLICT",
			title: "Merge conflict",
			message: "There was a merge conflict.",
			technicalDetails: "CONFLICT (content): Merge conflict in notes.json",
			suggestions: ["Resolve the conflict", "Retry the sync"],
		};

		useErrorDialogStore.setState({ queue: [error] });
		render(<GlobalErrorDialog />);

		const dialog = await screen.findByRole("dialog");
		expect(criticalOrSerious(await axe(dialog, AXE_OPTIONS))).toEqual([]);
	});

	it("modal has no critical/serious violations", async () => {
		render(
			<Modal isOpen onClose={() => {}} title="Settings">
				<p>Modal body content.</p>
				<button type="button">Save</button>
			</Modal>,
		);

		const dialog = await screen.findByRole("dialog");
		expect(criticalOrSerious(await axe(dialog, AXE_OPTIONS))).toEqual([]);
	});

	it("move document dialog has no critical/serious violations", async () => {
		render(
			<MoveDocumentDialog
				isOpen
				onClose={() => {}}
				documentPaths={["projects/@current/doc-1.json"]}
				currentProjectAlias="@current"
				onMoved={() => {}}
			/>,
		);

		const dialog = await screen.findByRole("dialog");
		expect(criticalOrSerious(await axe(dialog, AXE_OPTIONS))).toEqual([]);
	});

	it("help modal has no critical/serious violations", async () => {
		render(<HelpModal />);

		const dialog = await screen.findByRole("dialog");
		expect(criticalOrSerious(await axe(dialog, AXE_OPTIONS))).toEqual([]);
	});

	it("migration conflict dialog has no critical/serious violations", async () => {
		render(
			<MigrationConflictDialog
				isOpen
				isLoading={false}
				onCancel={() => {}}
				onConfirm={() => {}}
				conflictInfo={{
					localPath: "/tmp/local",
					targetPath: "/tmp/target",
					localVault: {
						projectCount: 1,
						documentCount: 2,
						totalSizeBytes: 100,
						totalSizeHuman: "100 B",
					},
					targetVault: {
						projectCount: 2,
						documentCount: 4,
						totalSizeBytes: 200,
						totalSizeHuman: "200 B",
					},
				}}
			/>,
		);

		const dialog = await screen.findByRole("dialog");
		expect(criticalOrSerious(await axe(dialog, AXE_OPTIONS))).toEqual([]);
		expect(screen.getByRole("radio", { name: /Use Target/i })).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});

	it("button has no critical/serious violations and sets aria-disabled when disabled", async () => {
		const { rerender } = render(<Button>Save</Button>);
		const btn = screen.getByRole("button", { name: "Save" });
		expect(criticalOrSerious(await axe(btn, AXE_OPTIONS))).toEqual([]);

		rerender(
			<Button disabled variant="primary">
				Save
			</Button>,
		);
		const disabledBtn = screen.getByRole("button", { name: "Save" });
		expect(disabledBtn).toBeDisabled();
		expect(disabledBtn).toHaveAttribute("aria-disabled", "true");
	});

	it("input has no critical/serious violations and sets aria-invalid when error", async () => {
		const { rerender } = render(<Input placeholder="Name" />);
		const input = screen.getByPlaceholderText("Name");
		expect(criticalOrSerious(await axe(input, AXE_OPTIONS))).toEqual([]);
		expect(input).not.toHaveAttribute("aria-invalid");

		rerender(<Input placeholder="Name" error />);
		const erroredInput = screen.getByPlaceholderText("Name");
		expect(erroredInput).toHaveAttribute("aria-invalid", "true");
	});

	it("toast has no critical/serious violations", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation((message) => {
			if (
				typeof message === "string" &&
				message.includes("An update to ToastAnnounce inside a test was not wrapped in act")
			) {
				return;
			}
		});

		await act(async () => {
			render(
				<ToastProvider>
					<ToastViewport />
					<Toast open variant="error">
						<ToastTitle>Save failed</ToastTitle>
						<ToastDescription>The vault could not be written.</ToastDescription>
						<ToastClose />
					</Toast>
				</ToastProvider>,
			);
		});

		await waitFor(() => expect(screen.getByText("Save failed")).toBeInTheDocument());
		await act(async () => {});
		expect(criticalOrSerious(await axe(document.body, AXE_OPTIONS))).toEqual([]);
		consoleError.mockRestore();
	});
});
