import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { vi } from "vitest";
import type { PageName } from "../shared/types";
import type { HotkeyContextValue } from "../shared/types/hotkeys";

const openHelp = vi.fn();

vi.mock("../help", () => ({
	useHelp: () => ({
		openHelp,
		setPageContext: vi.fn(),
	}),
	HelpModal: () => <div data-testid="help-modal" />,
}));

vi.mock("../app/components/TitleBar", () => ({
	TitleBar: () => <div data-testid="title-bar" />,
}));

vi.mock("../app/components/ResizeHandles", () => ({
	ResizeHandles: () => null,
}));

const commandPaletteRender = vi.fn();

vi.mock("../command-palette", async () => {
	const store = await vi.importActual<typeof import("../command-palette/commandPalette.store")>(
		"../command-palette/commandPalette.store",
	);
	return {
		useCommandPaletteStore: store.useCommandPaletteStore,
		GlobalCommandPalette: (props: { onClose: () => void; onNavigate: (page: PageName) => void }) => {
			const isOpen = store.useCommandPaletteStore((s: { isOpen: boolean }) => s.isOpen);
			commandPaletteRender({ ...props, isOpen });
			return <div data-testid="command-palette" data-open={String(isOpen)} />;
		},
	};
});

vi.mock("../app/Router", () => ({
	Router: () => <div data-testid="router" />,
}));

let capturedHotkeyContext: HotkeyContextValue | null = null;

vi.mock("../hotkeys", async () => {
	const context = await vi.importActual<typeof import("../hotkeys/context")>("../hotkeys/context");
	const hooks = await vi.importActual<typeof import("../hotkeys/hooks")>("../hotkeys/hooks");

	const HotkeyCapture: React.FC<{ children: React.ReactNode }> = ({ children }) => {
		const ctx = context.useHotkeyContext();
		React.useEffect(() => {
			capturedHotkeyContext = ctx;
		}, [ctx]);
		return <>{children}</>;
	};

	return {
		...context,
		...hooks,
		HotkeyProvider: ({ children }: { children: React.ReactNode }) => (
			<context.HotkeyProvider>
				<HotkeyCapture>{children}</HotkeyCapture>
			</context.HotkeyProvider>
		),
	};
});

vi.mock("../project", () => ({
	useProjectContext: () => ({
		currentProject: { name: "Project", alias: "project" },
		projects: [],
		setCurrentProject: vi.fn(),
		switchToLastProject: vi.fn(),
		previousProject: null,
		isLoading: false,
	}),
}));

vi.mock("../../wailsjs/runtime/runtime", () => ({
	EventsOn: vi.fn(() => () => {}),
}));

vi.mock("../../bindings/yanta/internal/system/service", () => ({
	GetAppScale: vi.fn(() => Promise.resolve(1.0)),
}));

vi.mock("../shared/ui/Toast", () => ({
	ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
	useToast: () => ({
		show: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		dismiss: vi.fn(),
		dismissAll: vi.fn(),
	}),
}));

vi.mock("../pane", () => ({
	usePaneLayout: () => ({
		loadAndRestoreLayout: vi.fn(),
		layout: {
			root: { type: "leaf", id: "pane-1" },
			activePaneId: "pane-1",
			primaryDocumentPath: null,
		},
		activePaneId: "pane-1",
	}),
}));

vi.mock("../config", () => ({
	GLOBAL_SHORTCUTS: {
		help: { key: "shift+/", description: "Toggle help" },
		quit: { key: "ctrl+q", description: "Quit (background if enabled)" },
		forceQuit: {
			key: "ctrl+shift+q",
			description: "Force quit application",
		},
		commandPalette: { key: "mod+K", description: "Open command palette" },
		today: { key: "mod+T", description: "Jump to today's journal" },
		switchProject: {
			key: "ctrl+Tab",
			description: "Switch to last project",
		},
	},
	SIDEBAR_SHORTCUTS: {
		toggle: {
			key: "ctrl+b",
			description: "Toggle sidebar",
			category: "navigation",
		},
	},
	LAYOUT: { maxPanes: 4 },
}));

vi.mock("../onboarding", () => ({
	useUserProgressContext: () => ({
		userProgress: null,
		setUserProgress: vi.fn(),
	}),
}));

// Mock heavy sub-hooks of useAppGlobalEffects
vi.mock("../app/hooks/useWindowHiddenToast", () => ({
	useWindowHiddenToast: () => {},
}));

vi.mock("../app/hooks/useProjectSwitchTracking", () => ({
	useProjectSwitchTracking: () => {},
}));

vi.mock("../shared/hooks", () => ({
	useNotification: () => ({
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	}),
}));

import { AppGlobalEffects, GlobalCommandHotkey } from "../app/global-hotkeys";
import { useCommandPaletteStore } from "../command-palette/commandPalette.store";
import { HotkeyProvider } from "../hotkeys";

const MockApp = () => (
	<HotkeyProvider>
		<AppGlobalEffects />
		<GlobalCommandHotkey />
	</HotkeyProvider>
);

describe("App hotkeys", () => {
	beforeEach(() => {
		openHelp.mockClear();
		commandPaletteRender.mockClear();
		capturedHotkeyContext = null;
		useCommandPaletteStore.getState().reset();
	});

	it("opens help modal with Shift+/", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const hotkey = capturedHotkeyContext?.getRegisteredHotkeys().find((h) => h.key === "shift+/");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey?.handler(new KeyboardEvent("keydown", { key: "?", shiftKey: true }));
		});

		expect(openHelp).toHaveBeenCalledTimes(1);
	});

	it("opens command palette with mod+K", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const palette = screen.getByTestId("command-palette");
		expect(palette).toHaveAttribute("data-open", "false");

		const hotkey = capturedHotkeyContext?.getRegisteredHotkeys().find((h) => h.key === "mod+K");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey?.handler(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
		});

		expect(palette).toHaveAttribute("data-open", "true");
		expect(commandPaletteRender).toHaveBeenLastCalledWith(expect.objectContaining({ isOpen: true }));
	});
});
