import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DialogProvider, TitleBarProvider } from "../app/context";

vi.mock("../config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config")>();
	return {
		...actual,
		SIDEBAR_SHORTCUTS: {
			toggle: { key: "ctrl+b", description: "Toggle sidebar" },
		},
		LAYOUT: { maxPanes: 4 },
	};
});

vi.mock("../hotkeys", () => ({
	useHotkeys: vi.fn(),
	HotkeyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	useHotkeyContext: () => ({ getRegisteredHotkeys: () => [] }),
}));

vi.mock("../shared/hooks/useSidebarSetting", () => ({
	useSidebarSetting: () => ({
		sidebarVisible: false,
		isLoading: false,
		setSidebarVisible: vi.fn(),
		toggleSidebar: vi.fn(),
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
		currentProject: { name: "Test Project" },
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

import type React from "react";
import { Layout } from "../app";
import { HotkeyProvider } from "../hotkeys";

const renderWithProviders = (currentPage: string) => {
	return render(
		<DialogProvider>
			<HotkeyProvider>
				<TitleBarProvider>
					<Layout currentPage={currentPage}>
						<div data-testid="content">content</div>
					</Layout>
				</TitleBarProvider>
			</HotkeyProvider>
		</DialogProvider>,
	);
};

describe("Layout data-mode attribute", () => {
	it("sets data-mode='documents' for dashboard page", () => {
		renderWithProviders("dashboard");
		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-mode", "documents");
	});

	it("sets data-mode='documents' for document page", () => {
		renderWithProviders("document");
		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-mode", "documents");
	});

	it("sets data-mode='journal' for journal page", () => {
		renderWithProviders("journal");
		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-mode", "journal");
	});

	it("sets data-mode='neutral' for settings page", () => {
		renderWithProviders("settings");
		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-mode", "neutral");
	});

	it("sets data-mode='neutral' for projects page", () => {
		renderWithProviders("projects");
		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-mode", "neutral");
	});

	it("sets data-mode='neutral' for search page", () => {
		renderWithProviders("search");
		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-mode", "neutral");
	});

	it("sets data-mode='neutral' for unknown pages", () => {
		renderWithProviders("unknown-page");
		const root = screen.getByTestId("layout-root");
		expect(root).toHaveAttribute("data-mode", "neutral");
	});
});
