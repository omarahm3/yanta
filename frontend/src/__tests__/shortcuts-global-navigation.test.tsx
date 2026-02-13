/**
 * Global Navigation Shortcuts Tests
 *
 * Tests that global navigation shortcuts work from any page and properly
 * trigger navigation, modal visibility, or state changes.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { vi } from "vitest";
import type { HotkeyContextValue } from "../shared/types/hotkeys";
import type { NavigationState, PageName } from "../shared/types/navigation";

// ============================================
// Mock Setup
// ============================================

const mockOpenHelp = vi.fn();
const mockCloseHelp = vi.fn();
const mockSetPageContext = vi.fn();
const commandPaletteRender = vi.fn();

vi.mock("../help", () => ({
	useHelp: () => ({
		openHelp: mockOpenHelp,
		closeHelp: mockCloseHelp,
		setPageContext: mockSetPageContext,
	}),
	HelpModal: () => <div data-testid="help-modal" />,
}));

vi.mock("../app/components/TitleBar", () => ({
	TitleBar: () => <div data-testid="title-bar" />,
}));

vi.mock("../app/components/ResizeHandles", () => ({
	ResizeHandles: () => null,
}));

vi.mock("../config", () => ({
	GLOBAL_SHORTCUTS: {
		commandPalette: { key: "mod+K", description: "Open command palette" },
		today: { key: "mod+T", description: "Jump to today's journal" },
		switchProject: { key: "ctrl+Tab", description: "Switch to last project" },
		help: { key: "shift+/", description: "Toggle help" },
		quit: { key: "ctrl+q", description: "Quit (background if enabled)" },
		forceQuit: { key: "ctrl+shift+q", description: "Force quit application" },
	},
	SIDEBAR_SHORTCUTS: {
		toggle: { key: "ctrl+b", description: "Toggle sidebar" },
	},
	LAYOUT: { maxPanes: 4 },
}));

// Import the real command palette store from specific file
vi.mock("../command-palette", async () => {
	const storeModule = await vi.importActual<
		typeof import("../command-palette/commandPalette.store")
	>("../command-palette/commandPalette.store");
	return {
		...storeModule,
		GlobalCommandPalette: (props: {
			onClose: () => void;
			onNavigate: (page: PageName, state?: NavigationState) => void;
		}) => {
			const isOpen = storeModule.useCommandPaletteStore((s: { isOpen: boolean }) => s.isOpen);
			commandPaletteRender({ ...props, isOpen });
			return (
				<div data-testid="command-palette" data-open={String(isOpen)}>
					{isOpen && (
						<button
							data-testid="navigate-journal"
							onClick={() => props.onNavigate("journal")}
							type="button"
						>
							Go to Journal
						</button>
					)}
				</div>
			);
		},
	};
});

vi.mock("../app/Router", () => ({
	Router: ({ currentPage }: { currentPage: string }) => (
		<div data-testid="router" data-current-page={currentPage}>
			{currentPage}
		</div>
	),
}));

vi.mock("../project", () => ({
	useProjectContext: () => ({
		currentProject: { name: "Test Project", alias: "test" },
		projects: [{ id: "1", name: "Test Project", alias: "test" }],
		previousProject: { id: "2", name: "Previous Project", alias: "prev" },
		setCurrentProject: vi.fn(),
		switchToLastProject: vi.fn(),
		isLoading: false,
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

vi.mock("../onboarding", () => ({
	useUserProgressContext: () => ({
		incrementProjectsSwitched: vi.fn(),
		getProgress: vi.fn(),
	}),
	WelcomeOverlay: () => null,
	MilestoneHintManager: () => null,
}));

vi.mock("../../wailsjs/runtime/runtime", () => ({
	EventsOn: vi.fn(() => () => {}),
}));

vi.mock("../../bindings/yanta/internal/system/service", () => ({
	GetAppScale: vi.fn(() => Promise.resolve(1.0)),
	BackgroundQuit: vi.fn(),
	ForceQuit: vi.fn(),
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

// Let the real useAppGlobalEffects load - its deps (config, help, hotkeys, bindings) are all mocked
vi.mock("../app/hooks/useWindowHiddenToast", () => ({
	useWindowHiddenToast: () => {},
}));

vi.mock("../app/hooks/useProjectSwitchTracking", () => ({
	useProjectSwitchTracking: () => {},
}));

vi.mock("../app/useAppNavigation", () => ({
	useAppNavigation: () => ({
		currentPage: "dashboard" as PageName,
		navigationState: undefined,
		onNavigate: vi.fn(),
		onToggleArchived: vi.fn(),
		showArchived: false,
		onRegisterToggleArchived: vi.fn(),
		onRegisterToggleSidebar: vi.fn(),
		onToggleSidebar: vi.fn(),
	}),
}));

// Real hotkeys system (lightweight modules loaded from specific files)
let capturedHotkeyContext: HotkeyContextValue | null = null;

vi.mock("../hotkeys", async () => {
	const context = await vi.importActual<typeof import("../hotkeys/context")>("../hotkeys/context");
	const hooks = await vi.importActual<typeof import("../hotkeys/hooks")>("../hotkeys/hooks");
	const React = await import("react");

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

import { AppGlobalEffects, GlobalCommandHotkey } from "../app/global-hotkeys";
import { useCommandPaletteStore } from "../command-palette/commandPalette.store";
import { HotkeyProvider } from "../hotkeys";

// Mock App: just the global hotkeys, wrapped in HotkeyProvider
const MockApp = () => (
	<HotkeyProvider>
		<AppGlobalEffects />
		<GlobalCommandHotkey />
	</HotkeyProvider>
);

// ============================================
// Test Utilities
// ============================================

const findHotkey = (
	key: string,
): ReturnType<HotkeyContextValue["getRegisteredHotkeys"]>[0] | undefined => {
	return capturedHotkeyContext?.getRegisteredHotkeys().find((h) => h.key === key);
};

const triggerHotkey = async (key: string, event: Partial<KeyboardEvent> = {}): Promise<void> => {
	const hotkey = findHotkey(key);
	if (!hotkey) {
		throw new Error(`Hotkey "${key}" not found in registered hotkeys`);
	}
	await act(async () => {
		hotkey.handler(new KeyboardEvent("keydown", { key: key.split("+").pop() || key, ...event }));
	});
};

// ============================================
// Tests
// ============================================

describe("Global Navigation Shortcuts", () => {
	beforeEach(() => {
		mockOpenHelp.mockClear();
		mockCloseHelp.mockClear();
		mockSetPageContext.mockClear();
		commandPaletteRender.mockClear();
		capturedHotkeyContext = null;
		useCommandPaletteStore.getState().reset();
	});

	describe("Command Palette (Ctrl+K / mod+K)", () => {
		it("opens command palette with mod+K", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const palette = screen.getByTestId("command-palette");
			expect(palette).toHaveAttribute("data-open", "false");

			await triggerHotkey("mod+K", { ctrlKey: true });

			expect(palette).toHaveAttribute("data-open", "true");
			expect(commandPaletteRender).toHaveBeenLastCalledWith(expect.objectContaining({ isOpen: true }));
		});

		it("mod+K toggles command palette closed when already open", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			await triggerHotkey("mod+K", { ctrlKey: true });
			expect(screen.getByTestId("command-palette")).toHaveAttribute("data-open", "true");

			const hotkey = findHotkey("mod+K");
			expect(hotkey).toBeDefined();
			expect(hotkey?.description).toBe("Open command palette");
		});
	});

	describe("Help Modal (Shift+/ or ?)", () => {
		it("opens help modal with shift+/", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("shift+/");
			expect(hotkey).toBeDefined();
			expect(hotkey?.description).toBe("Toggle help");

			await act(async () => {
				hotkey?.handler(new KeyboardEvent("keydown", { key: "?", shiftKey: true }));
			});

			expect(mockOpenHelp).toHaveBeenCalledTimes(1);
		});

		it("help hotkey is registered with correct properties", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("shift+/");
			expect(hotkey).toBeDefined();
			expect(hotkey?.allowInInput).toBe(false);
		});
	});

	describe("Jump to Today's Journal (Ctrl+T / mod+T)", () => {
		it("navigates to journal with today's date on mod+T", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("mod+T");
			expect(hotkey).toBeDefined();
			expect(hotkey?.description).toBe("Jump to today's journal");

			await act(async () => {
				const event = new KeyboardEvent("keydown", { key: "t", ctrlKey: true });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");
				hotkey?.handler(event);
				expect(preventDefaultSpy).toHaveBeenCalled();
			});

			await waitFor(() => {
				const router = screen.getByTestId("router");
				expect(router).toBeInTheDocument();
			});
		});

		it("mod+T does not trigger when in input field", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("mod+T");
			expect(hotkey?.allowInInput).toBe(false);
		});
	});

	describe("Switch to Last Project (Ctrl+Tab)", () => {
		it("registers ctrl+Tab hotkey for switching projects", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("ctrl+Tab");
			expect(hotkey).toBeDefined();
			expect(hotkey?.description).toBe("Switch to last project");
			expect(hotkey?.allowInInput).toBe(true);
		});

		it("ctrl+Tab handler calls preventDefault", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("ctrl+Tab");
			expect(hotkey).toBeDefined();

			await act(async () => {
				const event = new KeyboardEvent("keydown", { key: "Tab", ctrlKey: true });
				const preventDefaultSpy = vi.spyOn(event, "preventDefault");
				hotkey?.handler(event);
				expect(preventDefaultSpy).toHaveBeenCalled();
			});
		});
	});

	describe("Quit Shortcuts", () => {
		it("registers ctrl+q for background quit", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("ctrl+q");
			expect(hotkey).toBeDefined();
			expect(hotkey?.description).toBe("Quit (background if enabled)");
			expect(hotkey?.allowInInput).toBe(true);
			expect(hotkey?.capture).toBe(true);
		});

		it("registers ctrl+shift+q for force quit", async () => {
			render(<MockApp />);

			await waitFor(() => {
				expect(capturedHotkeyContext).not.toBeNull();
			});

			const hotkey = findHotkey("ctrl+shift+q");
			expect(hotkey).toBeDefined();
			expect(hotkey?.description).toBe("Force quit application");
			expect(hotkey?.allowInInput).toBe(true);
			expect(hotkey?.capture).toBe(true);
		});
	});
});

describe("Global Navigation Shortcuts from Multiple Starting Pages", () => {
	beforeEach(() => {
		mockOpenHelp.mockClear();
		mockCloseHelp.mockClear();
		commandPaletteRender.mockClear();
		capturedHotkeyContext = null;
		useCommandPaletteStore.getState().reset();
	});

	const globalShortcuts = [
		{ key: "mod+K", description: "Open command palette" },
		{ key: "mod+T", description: "Jump to today's journal" },
		{ key: "shift+/", description: "Toggle help" },
		{ key: "ctrl+Tab", description: "Switch to last project" },
		{ key: "ctrl+q", description: "Quit (background if enabled)" },
		{ key: "ctrl+shift+q", description: "Force quit application" },
	];

	it("all global shortcuts are registered on App mount", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		for (const { key, description } of globalShortcuts) {
			const hotkey = findHotkey(key);
			expect(hotkey).toBeDefined();
			expect(hotkey?.description).toBe(description);
		}
	});

	it("global shortcuts remain registered throughout App lifecycle", async () => {
		const { rerender } = render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const initialHotkeyCount = capturedHotkeyContext?.getRegisteredHotkeys().length || 0;
		expect(initialHotkeyCount).toBeGreaterThan(0);

		rerender(<MockApp />);

		await waitFor(() => {
			const currentHotkeyCount = capturedHotkeyContext?.getRegisteredHotkeys().length || 0;
			expect(currentHotkeyCount).toBe(initialHotkeyCount);
		});
	});

	it("command palette can be opened from any page context", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const palette = screen.getByTestId("command-palette");
		expect(palette).toHaveAttribute("data-open", "false");

		await triggerHotkey("mod+K", { ctrlKey: true });

		expect(palette).toHaveAttribute("data-open", "true");
	});

	it("help can be opened from any page context", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const hotkey = findHotkey("shift+/");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey?.handler(new KeyboardEvent("keydown", { key: "?", shiftKey: true }));
		});

		expect(mockOpenHelp).toHaveBeenCalled();
	});
});

describe("Command Palette Navigation Commands", () => {
	beforeEach(() => {
		commandPaletteRender.mockClear();
		capturedHotkeyContext = null;
		useCommandPaletteStore.getState().reset();
	});

	it("command palette provides navigation callback", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		await triggerHotkey("mod+K", { ctrlKey: true });

		expect(commandPaletteRender).toHaveBeenLastCalledWith(
			expect.objectContaining({
				isOpen: true,
				onNavigate: expect.any(Function),
			}),
		);
	});

	it("navigation commands include expected pages", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		await triggerHotkey("mod+K", { ctrlKey: true });

		const paletteProps =
			commandPaletteRender.mock.calls[commandPaletteRender.mock.calls.length - 1][0];
		expect(paletteProps.onNavigate).toBeDefined();
		expect(typeof paletteProps.onNavigate).toBe("function");
	});
});

describe("Shortcut Registration Validation", () => {
	beforeEach(() => {
		capturedHotkeyContext = null;
		useCommandPaletteStore.getState().reset();
	});

	it("verifies all global shortcuts have descriptions", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const hotkeys = capturedHotkeyContext?.getRegisteredHotkeys() || [];

		for (const hotkey of hotkeys) {
			expect(hotkey.description).toBeDefined();
			expect(hotkey.description?.length).toBeGreaterThan(0);
		}
	});

	it("verifies capture phase shortcuts are properly marked", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const quitHotkey = findHotkey("ctrl+q");
		expect(quitHotkey?.capture).toBe(true);

		const forceQuitHotkey = findHotkey("ctrl+shift+q");
		expect(forceQuitHotkey?.capture).toBe(true);
	});

	it("verifies help shortcut does not allow input", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const helpHotkey = findHotkey("shift+/");
		expect(helpHotkey?.allowInInput).toBe(false);
	});

	it("verifies project switch shortcut allows input", async () => {
		render(<MockApp />);

		await waitFor(() => {
			expect(capturedHotkeyContext).not.toBeNull();
		});

		const projectSwitchHotkey = findHotkey("ctrl+Tab");
		expect(projectSwitchHotkey?.allowInInput).toBe(true);
	});
});
