import { render } from "@testing-library/react";
import { vi } from "vitest";

const mockSaveNow = vi.fn(async () => {});
const mockHandleEscape = vi.fn();
const mockHandleUnfocus = vi.fn();
const mockEditorFocus = vi.fn();

vi.mock("../document/components", () => ({
	__esModule: true,
	DocumentContent: () => <div data-testid="document-content" />,
	DocumentLoadingState: () => <div data-testid="loading" />,
	DocumentErrorState: () => <div data-testid="error" />,
}));

vi.mock("../document/hooks/useDocumentController", () => ({
	useDocumentController: () => ({
		isLoading: false,
		showError: false,
		sidebarSections: [],
		contentProps: {
			formData: { title: "Title", blocks: [], tags: [] },
			hasChanges: true,
			setTitle: vi.fn(),
			setBlocks: vi.fn(),
			removeTag: vi.fn(),
			setTags: vi.fn(),
			onEditorReady: vi.fn(),
			autoSave: {
				saveNow: mockSaveNow,
				hasUnsavedChanges: false,
				saveState: "idle",
				lastSaved: null,
				saveError: null,
			},
		},
		hotkeys: [
			{
				key: "mod+s",
				description: "Save document",
				handler: () => mockSaveNow(),
				allowInInput: true,
				capture: true,
			},
			{
				key: "Escape",
				description: "Escape",
				handler: () => mockHandleEscape(),
				allowInInput: true,
				capture: true,
			},
			{
				key: "mod+C",
				description: "Unfocus editor",
				handler: () => mockHandleUnfocus(),
				allowInInput: true,
				capture: true,
			},
			{
				key: "Enter",
				description: "Focus editor",
				handler: () => mockEditorFocus(),
			},
		],
		documentTitle: "Title",
		escapeHandler: mockHandleEscape,
	}),
}));

vi.mock("../config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config")>();
	return {
		...actual,
		SIDEBAR_SHORTCUTS: {
			toggle: { key: "ctrl+b", description: "Toggle sidebar", category: "navigation" },
		},
		LAYOUT: { maxPanes: 4 },
	};
});

// Capture hotkey configs registered by the Document component
let capturedHotkeys: Array<{ key: string; handler: (e: KeyboardEvent) => void }> = [];

vi.mock("../hotkeys", () => ({
	useHotkeys: (configs: Array<{ key: string; handler: (e: KeyboardEvent) => void }>) => {
		capturedHotkeys = configs;
	},
	useHotkey: vi.fn(),
}));

vi.mock("../shared/hooks", () => ({
	useNotification: () => ({
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	}),
	useRecentDocuments: () => ({
		addRecentDocument: vi.fn(),
		recentDocuments: [],
	}),
	useSidebarSections: () => [],
}));

vi.mock("../project", () => ({
	useProjectContext: () => ({
		currentProject: { alias: "proj", name: "Project" },
	}),
}));

vi.mock("../pane", () => ({
	usePaneLayout: () => ({ activePaneId: "pane-1" }),
}));

vi.mock("../help", () => ({
	useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../onboarding", () => ({
	useUserProgressContext: () => ({
		userProgress: null,
		setUserProgress: vi.fn(),
	}),
}));

import { Document } from "../document/DocumentPage";

function getRequiredHotkey(
	key: string,
	hotkeys: Array<{ key: string; handler: (e: KeyboardEvent) => void }>,
) {
	const hotkey = hotkeys.find((h) => h.key === key);
	expect(hotkey).toBeDefined();
	if (!hotkey) {
		throw new Error(`Expected hotkey "${key}" to be registered`);
	}
	return hotkey;
}

describe("Document hotkeys", () => {
	beforeEach(() => {
		mockSaveNow.mockClear();
		mockHandleEscape.mockClear();
		mockHandleUnfocus.mockClear();
		mockEditorFocus.mockClear();
		capturedHotkeys = [];
	});

	it("triggers auto-save immediately on mod+s", () => {
		render(<Document onNavigate={vi.fn()} initialTitle="Sample" />);

		const hotkey = getRequiredHotkey("mod+s", capturedHotkeys);

		hotkey.handler(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, code: "KeyS" }));

		expect(mockSaveNow).toHaveBeenCalledTimes(1);
	});

	it("handles escape key", () => {
		render(<Document onNavigate={vi.fn()} initialTitle="Sample" />);

		const hotkey = getRequiredHotkey("Escape", capturedHotkeys);

		hotkey.handler(new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }));

		expect(mockHandleEscape).toHaveBeenCalledTimes(1);
	});

	it("handles mod+C to unfocus editor", () => {
		render(<Document onNavigate={vi.fn()} initialTitle="Sample" />);

		const hotkey = getRequiredHotkey("mod+C", capturedHotkeys);

		hotkey.handler(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, code: "KeyC" }));

		expect(mockHandleUnfocus).toHaveBeenCalledTimes(1);
	});

	it("focuses editor on Enter", () => {
		render(<Document onNavigate={vi.fn()} initialTitle="Sample" />);

		const hotkey = getRequiredHotkey("Enter", capturedHotkeys);

		hotkey.handler(new KeyboardEvent("keydown", { key: "Enter", code: "Enter" }));

		expect(mockEditorFocus).toHaveBeenCalledTimes(1);
	});
});
