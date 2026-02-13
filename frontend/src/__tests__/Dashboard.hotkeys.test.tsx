import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { Restore, SoftDelete } from "../../bindings/yanta/internal/document/service";
import { DialogProvider } from "../app/context";
import { HotkeyProvider, useHotkeyContext } from "../hotkeys";
import type { HotkeyContextValue } from "../shared/types/hotkeys";

const onNavigate = vi.fn();
const selectNext = vi.fn();
const selectPrevious = vi.fn();
const loadDocuments = vi.fn();
const setSelectedIndex = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockRemoveRecentDocument = vi.fn();
const mockAddRecentDocument = vi.fn();
const mockSetPageContext = vi.fn();

// Hoisted stable objects for config mock — must be defined before vi.mock calls
const {
	DASHBOARD_SHORTCUTS,
	PANE_SHORTCUTS,
	mockMergedConfig,
	mockDocuments,
	mockSidebarSections,
	mockRecentDocs,
} = vi.hoisted(() => {
	const DASHBOARD_SHORTCUTS = {
		newDocument: { key: "mod+N", description: "Create new document" },
		toggleArchived: { key: "mod+shift+A", description: "Toggle archived documents view" },
		softDelete: { key: "mod+D", description: "Soft delete selected documents" },
		permanentDelete: { key: "mod+shift+D", description: "Permanently delete selected documents" },
		toggleSelection: { key: "Space", description: "Select/deselect highlighted document" },
		openHighlighted: { key: "Enter", description: "Open highlighted document" },
		highlightNext: { key: "j", description: "Highlight next document" },
		highlightPrev: { key: "k", description: "Highlight previous document" },
		navigateDown: { key: "ArrowDown", description: "Navigate down" },
		navigateUp: { key: "ArrowUp", description: "Navigate up" },
		move: { key: "mod+M", description: "Move selected documents" },
		archive: { key: "mod+A", description: "Archive selected documents" },
		restore: { key: "mod+U", description: "Restore archived documents" },
		exportMd: { key: "mod+E", description: "Export to markdown" },
		exportPdf: { key: "mod+shift+E", description: "Export to PDF" },
	};
	const PANE_SHORTCUTS = {
		focusLeft: { key: "mod+alt+ArrowLeft", description: "Focus left pane" },
		focusDown: { key: "mod+alt+ArrowDown", description: "Focus pane below" },
		focusUp: { key: "mod+alt+ArrowUp", description: "Focus pane above" },
		focusRight: { key: "mod+alt+ArrowRight", description: "Focus right pane" },
		splitRight: { key: "mod+\\", description: "Split pane right" },
		splitDown: { key: "mod+shift+\\", description: "Split pane down" },
		closePane: { key: "mod+alt+W", description: "Close current pane" },
	};
	// Stable config object — same reference across renders to prevent infinite re-render loops
	const mockMergedConfig = {
		timeouts: { debounce: 300, autoSave: 1000, toastDuration: 3000 },
		layout: { maxPanes: 4 },
		shortcuts: {
			global: {},
			sidebar: {},
			document: {},
			dashboard: DASHBOARD_SHORTCUTS,
			journal: {},
			projects: {},
			quickCapture: {},
			settings: {},
			commandLine: {},
			search: {},
			pane: PANE_SHORTCUTS,
		},
	};
	// Stable documents array — same reference across renders
	const mockDocuments = [
		{ path: "proj/doc1", title: "Doc 1" },
		{ path: "proj/doc2", title: "Doc 2" },
	];
	// Stable empty array for sidebar sections
	const mockSidebarSections: never[] = [];
	// Stable empty array for recent docs
	const mockRecentDocs: never[] = [];
	return {
		DASHBOARD_SHORTCUTS,
		PANE_SHORTCUTS,
		mockMergedConfig,
		mockDocuments,
		mockSidebarSections,
		mockRecentDocs,
	};
});

vi.mock("../shared/hooks/useNotification", () => ({
	useNotification: () => ({
		success: mockSuccess,
		error: mockError,
	}),
}));

// CRITICAL: All mock return values must be stable references (module-level or hoisted)
// to prevent infinite re-render loops in useCallback/useMemo/useEffect dependency arrays.
vi.mock("../shared/hooks", () => ({
	useNotification: () => ({
		success: mockSuccess,
		error: mockError,
	}),
	useRecentDocuments: () => ({
		removeRecentDocument: mockRemoveRecentDocument,
		addRecentDocument: mockAddRecentDocument,
		recentDocuments: mockRecentDocs,
	}),
	useSidebarSections: () => mockSidebarSections,
}));

vi.mock("../help", () => ({
	useHelp: () => ({ setPageContext: mockSetPageContext }),
}));

vi.mock("../shared/hooks/useSidebarSections", () => ({
	__esModule: true,
	useSidebarSections: () => mockSidebarSections,
}));

const mockCurrentProject = { alias: "proj", name: "Project" };
const mockProjects = [
	{ alias: "proj", name: "Project" },
	{ alias: "other", name: "Other" },
];

vi.mock("../project/context", () => ({
	useProjectContext: () => ({
		currentProject: mockCurrentProject,
		projects: mockProjects,
		archivedProjects: [],
		isLoading: false,
	}),
}));

vi.mock("../project", () => ({
	useProjectContext: () => ({
		currentProject: mockCurrentProject,
		projects: mockProjects,
		archivedProjects: [],
		isLoading: false,
	}),
}));

vi.mock("../document", () => ({
	useDocumentContext: () => ({
		documents: mockDocuments,
		loadDocuments,
		isLoading: false,
		selectedIndex: 0,
		setSelectedIndex,
		selectNext,
		selectPrevious,
	}),
}));

vi.mock("../dashboard/components/DocumentList", () => ({
	__esModule: true,
	DocumentList: ({
		highlightedIndex,
		selectedDocuments,
	}: {
		highlightedIndex?: number;
		selectedDocuments?: Set<string>;
	}) => (
		<div
			data-testid="document-list"
			data-highlighted={highlightedIndex ?? -1}
			data-selected={Array.from(selectedDocuments ?? new Set()).join(",")}
		/>
	),
}));

vi.mock("../dashboard/components/StatusBar", () => ({
	__esModule: true,
	StatusBar: () => <div data-testid="status-bar" />,
}));

vi.mock("../dashboard/components/MoveDocumentDialog", () => ({
	__esModule: true,
	MoveDocumentDialog: () => null,
}));

vi.mock("../../bindings/yanta/internal/commandline/documentcommands", () => ({
	ParseWithContext: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../bindings/yanta/internal/document/service", () => ({
	SoftDelete: vi.fn(),
	Restore: vi.fn(),
	ExportDocument: vi.fn(),
}));

vi.mock("../../bindings/yanta/internal/document/models", () => ({
	ExportDocumentRequest: {},
}));

vi.mock("../shared/services/DocumentService", () => ({
	DocumentServiceWrapper: {
		save: vi.fn(async () => "proj/new-doc-path"),
	},
	moveDocumentToProject: vi.fn(),
}));

const softDeleteMock = SoftDelete as unknown as ReturnType<typeof vi.fn>;
const restoreMock = Restore as unknown as ReturnType<typeof vi.fn>;

vi.mock("../../wailsjs/go/models", () => ({
	commandline: {
		DocumentCommand: {
			New: "new",
			Doc: "doc",
			Archive: "archive",
			Unarchive: "unarchive",
			Delete: "delete",
		},
	},
}));

vi.mock("../app", () => ({
	Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	GranularErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Static config mock — useMergedConfig returns stable reference to prevent infinite loops
vi.mock("../config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config")>();
	return {
		...actual,
		DocumentCommand: {
			DocumentCommandNew: "new",
			DocumentCommandDoc: "doc",
			DocumentCommandArchive: "archive",
			DocumentCommandUnarchive: "unarchive",
			DocumentCommandDelete: "delete",
		},
		LAYOUT: { maxPanes: 4 },
		TIMEOUTS: { debounce: 300, autoSave: 1000, toastDuration: 3000 },
		DASHBOARD_SHORTCUTS,
		PANE_SHORTCUTS,
		GLOBAL_SHORTCUTS: {},
		SIDEBAR_SHORTCUTS: {},
		DOCUMENT_SHORTCUTS: {},
		JOURNAL_SHORTCUTS: {},
		PROJECTS_SHORTCUTS: {},
		QUICK_CAPTURE_SHORTCUTS: {},
		SETTINGS_SHORTCUTS: {},
		COMMAND_LINE_SHORTCUTS: {},
		SEARCH_SHORTCUTS: {},
		EDITOR_SHORTCUTS: [],
		EDITOR_HELP_COMMANDS: [],
		GLOBAL_COMMANDS: [],
		ENABLE_TOOLTIP_HINTS: false,
		useMergedConfig: () => mockMergedConfig,
		getMergedConfig: () => mockMergedConfig,
		validatePluginConfig: () => ({ valid: true }),
		usePluginConfig: () => ({}),
	};
});

import { Dashboard } from "../dashboard";

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({ onReady }) => {
	const ctx = useHotkeyContext();
	React.useEffect(() => {
		onReady(ctx);
	}, [ctx, onReady]);
	return null;
};

describe("Dashboard hotkeys", () => {
	beforeEach(() => {
		onNavigate.mockClear();
		selectNext.mockClear();
		selectPrevious.mockClear();
		loadDocuments.mockClear();
		setSelectedIndex.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
		softDeleteMock.mockClear();
		restoreMock.mockClear();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	const Wrapper: React.FC<{ onContext: (ctx: HotkeyContextValue) => void }> = ({ onContext }) => (
		<DialogProvider>
			<HotkeyProvider>
				<HotkeyProbe onReady={onContext} />
				<Dashboard onNavigate={onNavigate} onRegisterToggleArchived={() => {}} />
			</HotkeyProvider>
		</DialogProvider>
	);

	const renderDashboard = async () => {
		let ctx: HotkeyContextValue | null = null;
		// biome-ignore lint/suspicious/noAssignInExpressions: Test callback pattern
		render(<Wrapper onContext={(value) => (ctx = value)} />);
		await waitFor(() => expect(ctx).not.toBeNull());
		// biome-ignore lint/style/noNonNullAssertion: Test utility function ensures non-null
		return ctx!;
	};

	const getHotkey = (ctx: HotkeyContextValue, key: string) => {
		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === key);
		expect(hotkey).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: Test utility function ensures non-null
		return hotkey!;
	};

	it("navigates to new document with mod+N", async () => {
		const ctx = await renderDashboard();
		const modN = getHotkey(ctx, "mod+N");
		await act(async () => {
			modN.handler(new KeyboardEvent("keydown", { key: "n", ctrlKey: true }));
		});
		await waitFor(() =>
			expect(onNavigate).toHaveBeenCalledWith("document", {
				documentPath: "proj/new-doc-path",
				newDocument: true,
			}),
		);
	});

	it("toggles archived view with mod+shift+A", async () => {
		const ctx = await renderDashboard();
		const toggleHotkey = getHotkey(ctx, "mod+shift+A");
		await act(async () => {
			toggleHotkey.handler(
				new KeyboardEvent("keydown", {
					key: "A",
					ctrlKey: true,
					shiftKey: true,
				}),
			);
		});
		expect(mockSuccess).not.toHaveBeenCalled();
	});

	it("moves selection down with j", async () => {
		const ctx = await renderDashboard();
		const jHotkey = getHotkey(ctx, "j");
		await act(async () => {
			jHotkey.handler(new KeyboardEvent("keydown", { key: "j" }));
		});
		expect(selectNext).toHaveBeenCalled();
	});

	it("moves selection with arrow keys", async () => {
		const ctx = await renderDashboard();
		const downHotkey = getHotkey(ctx, "ArrowDown");
		const upHotkey = getHotkey(ctx, "ArrowUp");
		await act(async () => {
			downHotkey.handler(new KeyboardEvent("keydown", { key: "ArrowDown" }));
			upHotkey.handler(new KeyboardEvent("keydown", { key: "ArrowUp" }));
		});
		expect(selectNext).toHaveBeenCalled();
		expect(selectPrevious).toHaveBeenCalled();
	});

	it("opens selected document with Enter", async () => {
		const ctx = await renderDashboard();
		const enterHotkey = getHotkey(ctx, "Enter");
		await act(async () => {
			enterHotkey.handler(new KeyboardEvent("keydown", { key: "Enter" }));
		});
		expect(onNavigate).toHaveBeenCalledWith("document", {
			documentPath: "proj/doc1",
		});
	});

	it("archives selected documents with mod+A", async () => {
		const ctx = await renderDashboard();
		const spaceHotkey = getHotkey(ctx, "Space");
		const archiveHotkey = getHotkey(ctx, "mod+A");

		await act(async () => {
			spaceHotkey.handler(new KeyboardEvent("keydown", { key: " " }));
		});

		await act(async () => {
			archiveHotkey.handler(new KeyboardEvent("keydown", { key: "a", ctrlKey: true }));
		});

		await waitFor(() => expect(softDeleteMock).toHaveBeenCalledWith("proj/doc1"));
	});

	it("restores selected documents with mod+U when archived view is shown", async () => {
		const ctx = await renderDashboard();
		const toggleHotkey = getHotkey(ctx, "mod+shift+A");
		vi.useFakeTimers();
		await act(async () => {
			toggleHotkey.handler(
				new KeyboardEvent("keydown", {
					key: "A",
					ctrlKey: true,
					shiftKey: true,
				}),
			);
		});
		vi.runAllTimers();
		vi.clearAllTimers();
		vi.useRealTimers();
		mockSuccess.mockClear();

		const spaceHotkey = getHotkey(ctx, "Space");
		const restoreHotkey = getHotkey(ctx, "mod+U");

		await act(async () => {
			spaceHotkey.handler(new KeyboardEvent("keydown", { key: " " }));
		});

		await act(async () => {
			restoreHotkey.handler(new KeyboardEvent("keydown", { key: "u", ctrlKey: true }));
		});

		await waitFor(() => expect(restoreMock).toHaveBeenCalledWith("proj/doc1"));
	});
});
