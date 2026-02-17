import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

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

// Mock useSidebarSetting to start with sidebar visible for testing
const mockToggleSidebar = vi.fn();
let mockSidebarVisible = true;

vi.mock("../shared/hooks/useSidebarSetting", () => ({
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

vi.mock("../shared/hooks/useFooterHints", () => ({
	useFooterHints: () => ({
		hints: [{ key: "Ctrl+K", label: "Commands" }],
	}),
}));

vi.mock("../shared/hooks/useFooterHintsSetting", () => ({
	useFooterHintsSetting: () => ({
		showFooterHints: true,
		isLoading: false,
		setShowFooterHints: vi.fn(),
		toggleFooterHints: vi.fn(),
	}),
}));

vi.mock("../project", () => ({
	useProjectContext: () => ({
		currentProject: { name: "Test Project", alias: "test-project" },
	}),
}));

vi.mock("../shared/ui", () => ({
	__esModule: true,
	HeaderBar: ({ currentPage }: { currentPage: string }) => (
		<div data-testid="header">{currentPage}</div>
	),
	Sidebar: ({ title }: { title?: string }) => <div data-testid="sidebar">{title ?? "Sidebar"}</div>,
	FooterHintBar: ({ hints }: { hints: { key: string; label: string }[] }) => (
		<div data-testid="footer-hint-bar-mock">{hints.length} hints</div>
	),
}));

// Capture registered hotkeys from the useHotkeys mock
let capturedHotkeys: Array<{ key: string; handler: (e: KeyboardEvent) => void }> = [];

vi.mock("../hotkeys", () => ({
	useHotkeys: (configs: Array<{ key: string; handler: (e: KeyboardEvent) => void }>) => {
		capturedHotkeys = configs;
	},
	useHotkey: vi.fn(),
	HotkeyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	useHotkeyContext: () => ({ getRegisteredHotkeys: () => [] }),
	createHotkeyMatcher: vi.fn(),
}));

import type React from "react";
import { Layout } from "../app";

describe("Layout hotkeys", () => {
	beforeEach(() => {
		mockToggleSidebar.mockClear();
		mockSidebarVisible = true;
		capturedHotkeys = [];
	});

	it("registers ctrl+b hotkey that toggles sidebar", () => {
		render(
			<Layout currentPage="dashboard">
				<div data-testid="content">content</div>
			</Layout>,
		);

		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-sidebar-visible", "true");

		// Verify Layout registered the sidebar toggle hotkey
		const toggleHotkey = capturedHotkeys.find((h) => h.key === "ctrl+b");
		expect(toggleHotkey).toBeDefined();

		// Invoke the handler directly
		toggleHotkey?.handler(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, code: "KeyB" }));

		expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
	});
});
