import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { HotkeyContextValue } from "../types/hotkeys";

const openHelp = vi.fn();

vi.mock("../hooks/useHelp", () => ({
	useHelp: () => ({
		openHelp,
		setPageContext: vi.fn(),
	}),
}));

vi.mock("../components/ui/TitleBar", () => ({
	TitleBar: () => <div data-testid="title-bar" />,
}));

vi.mock("../components/ui/HelpModal", () => ({
	HelpModal: () => <div data-testid="help-modal" />,
}));

vi.mock("../components/ui/ResizeHandles", () => ({
	ResizeHandles: () => null,
}));

const commandPaletteRender = vi.fn();
vi.mock("../components", async () => {
	const actual = await vi.importActual<typeof import("../components")>("../components");
	return {
		...actual,
		GlobalCommandPalette: (props: {
			isOpen: boolean;
			onClose: () => void;
			onNavigate: (page: string) => void;
		}) => {
			commandPaletteRender(props);
			return <div data-testid="command-palette" data-open={props.isOpen} />;
		},
	};
});

vi.mock("../components/Router", () => ({
	Router: () => <div data-testid="router" />, // navigation handled elsewhere
}));

let capturedHotkeyContext: HotkeyContextValue | null = null;

vi.mock("../contexts", async () => {
	const actual = await vi.importActual<typeof import("../contexts")>("../contexts");
	const React = await import("react");

	const HotkeyCapture: React.FC = () => {
		const ctx = actual.useHotkeyContext();
		React.useEffect(() => {
			capturedHotkeyContext = ctx;
		}, [ctx]);
		return null;
	};

	return {
		...actual,
		HotkeyProvider: ({ children }: { children: React.ReactNode }) => (
			<actual.HotkeyProvider>
				<HotkeyCapture />
				{children}
			</actual.HotkeyProvider>
		),
		ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		DocumentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		DocumentCountProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		HelpProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		useProjectContext: () => ({
			currentProject: { name: "Project", alias: "project" },
			projects: [],
			setCurrentProject: vi.fn(),
			isLoading: false,
		}),
	};
});

vi.mock("../../wailsjs/runtime/runtime", () => ({
	EventsOn: vi.fn(() => () => {}),
}));

vi.mock("../components/ui/Toast", () => ({
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
