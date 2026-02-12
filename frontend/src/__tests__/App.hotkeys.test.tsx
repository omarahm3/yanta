import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { HotkeyContextValue } from "../shared/types/hotkeys";

const openHelp = vi.fn();

vi.mock("../help", async () => {
	const actual = await vi.importActual<typeof import("../help")>("../help");
	return {
		...actual,
		useHelp: () => ({
			openHelp,
			setPageContext: vi.fn(),
		}),
		HelpModal: () => <div data-testid="help-modal" />,
	};
});

vi.mock("../app/components/TitleBar", () => ({
	TitleBar: () => <div data-testid="title-bar" />,
}));

vi.mock("../app/components/ResizeHandles", () => ({
	ResizeHandles: () => null,
}));

const commandPaletteRender = vi.fn();
vi.mock("../command-palette", async () => {
	const actual = await vi.importActual<typeof import("../command-palette")>("../command-palette");
	return {
		...actual,
		GlobalCommandPalette: (props: {
			isOpen: boolean;
			onClose: () => void;
			onNavigate: (page: import("../types").PageName) => void;
		}) => {
			commandPaletteRender(props);
			return <div data-testid="command-palette" data-open={props.isOpen} />;
		},
	};
});

vi.mock("../app/Router", () => ({
	Router: () => <div data-testid="router" />, // navigation handled elsewhere
}));

let capturedHotkeyContext: HotkeyContextValue | null = null;

vi.mock("../hotkeys", async () => {
	const actual = await vi.importActual<typeof import("../hotkeys")>("../hotkeys");
	const React = await import("react");

	const HotkeyCapture: React.FC<{ children: React.ReactNode }> = ({ children }) => {
		const ctx = actual.useHotkeyContext();
		React.useEffect(() => {
			capturedHotkeyContext = ctx;
		}, [ctx]);
		return <>{children}</>;
	};

	return {
		...actual,
		HotkeyProvider: ({ children }: { children: React.ReactNode }) => (
			<actual.HotkeyProvider>
				<HotkeyCapture>{children}</HotkeyCapture>
			</actual.HotkeyProvider>
		),
	};
});

vi.mock("../project", () => ({
	...vi.importActual("../project"),
	useProjectContext: () => ({
		currentProject: { name: "Project", alias: "project" },
		projects: [],
		setCurrentProject: vi.fn(),
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
	ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

import App from "../App";

describe("App hotkeys", () => {
	beforeEach(() => {
		openHelp.mockClear();
		commandPaletteRender.mockClear();
		capturedHotkeyContext = null;
	});

	it("opens help modal with Shift+/", async () => {
		render(<App />);

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
		render(<App />);

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
