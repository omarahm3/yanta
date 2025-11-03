import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { DialogProvider, HotkeyProvider, useHotkeyContext } from "../contexts";
import type { HotkeyContextValue } from "../types/hotkeys";

const mockSaveNow = vi.fn(async () => {});
const mockHandleEscape = vi.fn();
const mockHandleUnfocus = vi.fn();
const mockEditorFocus = vi.fn();

const mockEditor = {
	isFocused: () => false,
	focus: mockEditorFocus,
} as any;

vi.mock("../components/document", () => ({
	__esModule: true,
	DocumentContent: (props: any) => {
		props.onEditorReady?.(mockEditor);
		return <div data-testid="document-content" />;
	},
	DocumentLoadingState: () => <div data-testid="loading" />,
	DocumentErrorState: () => <div data-testid="error" />,
}));

vi.mock("../hooks/useSidebarSections", () => ({
	useSidebarSections: () => [],
}));

vi.mock("../hooks/useNotification", () => ({
	useNotification: () => ({
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	}),
}));

vi.mock("../hooks/useDocumentForm", () => ({
	useDocumentForm: () => ({
		formData: { title: "Title", blocks: [], tags: [] },
		hasChanges: true,
		setTitle: vi.fn(),
		setBlocks: vi.fn(),
		removeTag: vi.fn(),
		setTags: vi.fn(),
		resetChanges: vi.fn(),
		initializeForm: vi.fn(),
	}),
}));

vi.mock("../hooks/useDocumentInitialization", () => ({
	useDocumentInitialization: () => ({
		isLoading: false,
		loadError: null,
		shouldAutoSave: false,
		resetAutoSave: vi.fn(),
	}),
}));

vi.mock("../hooks/useDocumentPersistence", () => ({
	useDocumentPersistence: () => ({
		autoSave: {
			saveNow: mockSaveNow,
			hasUnsavedChanges: true,
			saveState: "idle",
			lastSaved: null,
			saveError: null,
		},
	}),
}));

vi.mock("../hooks/useDocumentEditor", () => ({
	useDocumentEditor: () => ({
		handleEditorReady: vi.fn(),
	}),
}));

vi.mock("../hooks/useDocumentEscapeHandling", () => ({
	useDocumentEscapeHandling: () => ({
		handleEscape: mockHandleEscape,
		handleUnfocus: mockHandleUnfocus,
	}),
}));

vi.mock("../hooks/useHelp", () => ({
	useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../contexts", async () => {
	const actual = await vi.importActual<typeof import("../contexts")>("../contexts");
	return {
		...actual,
		useProjectContext: () => ({
			currentProject: { alias: "proj", name: "Project" },
		}),
	};
});

vi.mock("../../wailsjs/go/commandline/DocumentCommands", () => ({
	ParseWithDocument: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../wailsjs/go/tag/Service", () => ({
	GetDocumentTags: vi.fn(async () => []),
}));

vi.mock("../../wailsjs/runtime/runtime", () => ({
	EventsOn: vi.fn(() => () => {}),
}));

import { Document } from "../pages/Document";

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({ onReady }) => {
	const ctx = useHotkeyContext();
	React.useEffect(() => {
		onReady(ctx);
	}, [ctx, onReady]);
	return null;
};

const renderDocument = async () => {
	let context: HotkeyContextValue | null = null;

	render(
		<DialogProvider>
			<HotkeyProvider>
				<HotkeyProbe onReady={(ctx) => (context = ctx)} />
				<Document onNavigate={vi.fn()} initialTitle="Sample" />
			</HotkeyProvider>
		</DialogProvider>,
	);

	await waitFor(() => {
		expect(context).not.toBeNull();
	});

	return context!;
};

describe("Document hotkeys", () => {
	beforeEach(() => {
		mockSaveNow.mockClear();
		mockHandleEscape.mockClear();
		mockHandleUnfocus.mockClear();
		mockEditorFocus.mockClear();
	});

	it("triggers auto-save immediately on mod+s", async () => {
		const ctx = await renderDocument();

		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "mod+s");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey!.handler(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, code: "KeyS" }));
		});

		await waitFor(() => expect(mockSaveNow).toHaveBeenCalledTimes(1));
	});

	it("handles escape key", async () => {
		const ctx = await renderDocument();

		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "Escape");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey!.handler(new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }));
		});

		await waitFor(() => expect(mockHandleEscape).toHaveBeenCalledTimes(1));
	});

	it("handles mod+C to unfocus editor", async () => {
		const ctx = await renderDocument();

		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "mod+C");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey!.handler(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, code: "KeyC" }));
		});

		await waitFor(() => expect(mockHandleUnfocus).toHaveBeenCalledTimes(1));
	});

	it("focuses editor on Enter", async () => {
		const ctx = await renderDocument();

		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "Enter");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey!.handler(new KeyboardEvent("keydown", { key: "Enter", code: "Enter" }));
		});

		await waitFor(() => expect(mockEditorFocus).toHaveBeenCalledTimes(1));
	});
});
