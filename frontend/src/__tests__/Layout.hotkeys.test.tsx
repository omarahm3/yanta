import { act, render, screen, waitFor } from "@testing-library/react";
import React, { useRef } from "react";
import { vi } from "vitest";
import { DialogProvider, HotkeyProvider, TitleBarProvider, useHotkeyContext } from "../contexts";
import type { HotkeyContextValue } from "../types/hotkeys";

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../hooks/useNotification", () => ({
	useNotification: () => ({
		success: mockSuccess,
		error: mockError,
	}),
}));

// Mock useSidebarSetting to start with sidebar visible for testing
const mockToggleSidebar = vi.fn();
let mockSidebarVisible = true;

vi.mock("../hooks/useSidebarSetting", () => ({
	useSidebarSetting: () => ({
		sidebarVisible: mockSidebarVisible,
		isLoading: false,
		setSidebarVisible: vi.fn(),
		toggleSidebar: () => {
			mockSidebarVisible = !mockSidebarVisible;
			mockToggleSidebar();
		},
	}),
}));

vi.mock("../hooks/useFooterHints", () => ({
	useFooterHints: () => ({
		hints: [{ key: "Ctrl+K", label: "Commands" }],
	}),
}));

const mockHandleCreateDocument = vi.fn();
const mockHandleCreateJournalEntry = vi.fn();

vi.mock("../hooks/useQuickCreate", () => ({
	useQuickCreate: () => ({
		handleCreateDocument: mockHandleCreateDocument,
		handleCreateJournalEntry: mockHandleCreateJournalEntry,
		currentProjectAlias: "test-project",
		isDisabled: false,
	}),
}));

vi.mock("../contexts", async () => {
	const actual = await vi.importActual<typeof import("../contexts")>("../contexts");
	return {
		...actual,
		useProjectContext: () => ({
			currentProject: { name: "Test Project", alias: "test-project" },
		}),
	};
});

vi.mock("../components/ui", () => ({
	__esModule: true,
	HeaderBar: ({ currentPage }: { currentPage: string }) => (
		<div data-testid="header">{currentPage}</div>
	),
	Sidebar: ({ title }: { title?: string }) => <div data-testid="sidebar">{title ?? "Sidebar"}</div>,
	ContextBar: () => <div data-testid="context-bar-mock" />,
	FooterHintBar: ({ hints }: { hints: { key: string; label: string }[] }) => (
		<div data-testid="footer-hint-bar-mock">{hints.length} hints</div>
	),
	QuickCreateInput: ({
		projectAlias,
		disabled,
	}: {
		projectAlias: string;
		disabled?: boolean;
	}) => (
		<div data-testid="quick-create-input">
			<span data-testid="project-alias">{projectAlias}</span>
			<input
				type="text"
				placeholder="Type to create..."
				disabled={disabled}
				data-testid="quick-create-input-field"
			/>
		</div>
	),
}));

import { Layout } from "../components/Layout";

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({ onReady }) => {
	const ctx = useHotkeyContext();
	React.useEffect(() => {
		onReady(ctx);
	}, [ctx, onReady]);
	return null;
};

describe("Layout hotkeys", () => {
	beforeEach(() => {
		mockSuccess.mockClear();
		mockError.mockClear();
		mockToggleSidebar.mockClear();
		mockHandleCreateDocument.mockClear();
		mockHandleCreateJournalEntry.mockClear();
		mockSidebarVisible = true; // Reset sidebar to visible state for each test
	});

	const Wrapper: React.FC<{
		onContext: (ctx: HotkeyContextValue) => void;
		showQuickCreate?: boolean;
	}> = ({ onContext, showQuickCreate = true }) => {
		const quickCreateInputRef = useRef<HTMLInputElement>(null);

		return (
			<DialogProvider>
				<HotkeyProvider>
					<TitleBarProvider>
						<HotkeyProbe onReady={onContext} />
						<Layout
							sidebarTitle="Test Sidebar"
							currentPage="dashboard"
							showQuickCreate={showQuickCreate}
							quickCreateInputRef={quickCreateInputRef}
						>
							<div data-testid="content">content</div>
						</Layout>
					</TitleBarProvider>
				</HotkeyProvider>
			</DialogProvider>
		);
	};

	const setup = async (showQuickCreate = true) => {
		let context: HotkeyContextValue | null = null;
		// biome-ignore lint/suspicious/noAssignInExpressions: Test callback pattern
		render(<Wrapper onContext={(ctx) => (context = ctx)} showQuickCreate={showQuickCreate} />);
		await waitFor(() => expect(context).not.toBeNull());
		// biome-ignore lint/style/noNonNullAssertion: Test utility function ensures non-null
		return context!;
	};

	it("toggles sidebar with ctrl+b", async () => {
		const ctx = await setup();
		const root = screen.getByTestId("layout-root");
		// Initial state should be visible (from mock)
		expect(root).toHaveAttribute("data-sidebar-visible", "true");

		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "ctrl+b");
		expect(hotkey).toBeDefined();

		await act(async () => {
			hotkey?.handler(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, code: "KeyB" }));
		});

		// Verify toggleSidebar was called
		expect(mockToggleSidebar).toHaveBeenCalledTimes(1);

		const toggleSidebarHotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "mod+e");
		expect(toggleSidebarHotkey).toBeDefined();

		await act(async () => {
			toggleSidebarHotkey?.handler(new KeyboardEvent("keydown", { key: "e", ctrlKey: true, code: "KeyE" }));
		});

		// Verify toggleSidebar was called again
		expect(mockToggleSidebar).toHaveBeenCalledTimes(2);
	});

	it("renders QuickCreateInput when showQuickCreate is true", async () => {
		await setup(true);
		expect(screen.getByTestId("quick-create-input")).toBeInTheDocument();
		expect(screen.getByTestId("project-alias")).toHaveTextContent("test-project");
	});

	it("does not render QuickCreateInput when showQuickCreate is false", async () => {
		await setup(false);
		expect(screen.queryByTestId("quick-create-input")).not.toBeInTheDocument();
	});

	it("registers Escape hotkey for QuickCreateInput blur when showQuickCreate is true", async () => {
		const ctx = await setup(true);
		const escapeHotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "Escape");
		expect(escapeHotkey).toBeDefined();
		expect(escapeHotkey?.description).toBe("Exit quick create input");
	});
});
