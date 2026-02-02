import { render, screen } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { DialogProvider, HotkeyProvider, TitleBarProvider } from "../contexts";

vi.mock("../hooks/useGlobalCommand", () => ({
	useGlobalCommand: () => ({
		executeGlobalCommand: async () => ({ handled: false }),
	}),
}));

vi.mock("../hooks/useNotification", () => ({
	useNotification: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock("../hooks/useSidebarSetting", () => ({
	useSidebarSetting: () => ({
		sidebarVisible: false,
		isLoading: false,
		setSidebarVisible: vi.fn(),
		toggleSidebar: vi.fn(),
	}),
}));

vi.mock("../hooks/useFooterHints", () => ({
	useFooterHints: () => ({
		hints: [{ key: "Ctrl+K", label: "Commands" }],
	}),
}));

vi.mock("../contexts", async () => {
	const actual = await vi.importActual<typeof import("../contexts")>("../contexts");
	return {
		...actual,
		useProjectContext: () => ({
			currentProject: { name: "Test Project" },
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
}));

import { Layout } from "../components/Layout";

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
