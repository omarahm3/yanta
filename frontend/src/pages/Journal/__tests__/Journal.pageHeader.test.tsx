import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { DialogProvider, HelpProvider, HotkeyProvider, ProjectContext } from "../../../contexts";

/**
 * Tests for Journal page header with mode icon
 * These tests verify the visual elements added for mode differentiation
 * by rendering the ACTUAL Journal component
 */

// Mock Layout to render children (header is part of children)
vi.mock("../../../components/Layout", () => ({
	Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock("../../../hooks/useSidebarSections", () => ({
	useSidebarSections: () => [],
}));

// Mock the journal service
vi.mock("../../../../bindings/yanta/internal/journal/wailsservice", () => ({
	GetActiveEntries: vi.fn(() => Promise.resolve([])),
	GetAllActiveEntries: vi.fn(() => Promise.resolve([])),
	DeleteEntry: vi.fn(() => Promise.resolve()),
	RestoreEntry: vi.fn(() => Promise.resolve()),
	ListDates: vi.fn(() => Promise.resolve([])),
	ListAllDates: vi.fn(() => Promise.resolve([])),
	PromoteToDocument: vi.fn(() => Promise.resolve("")),
}));

// Mock the project service
vi.mock("../../../../bindings/yanta/internal/project/service", () => ({
	ListActive: vi.fn(() => Promise.resolve([{ id: "1", alias: "personal", name: "Personal" }])),
}));

// Import after mocks
import { Journal } from "../Journal";

const mockProject = {
	id: "1",
	alias: "personal",
	name: "Personal",
	createdAt: "",
	updatedAt: "",
	startDate: "",
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
	<DialogProvider>
		<HelpProvider>
			<HotkeyProvider>
				<ProjectContext.Provider
					value={{
						currentProject: mockProject,
						projects: [mockProject],
						archivedProjects: [],
						setCurrentProject: vi.fn(),
						previousProject: undefined,
						switchToLastProject: vi.fn(),
						loadProjects: vi.fn(),
						isLoading: false,
					}}
				>
					{children}
				</ProjectContext.Provider>
			</HotkeyProvider>
		</HelpProvider>
	</DialogProvider>
);

describe("Journal page header visual elements", () => {
	it("renders the actual Journal with Journal heading", async () => {
		render(
			<TestWrapper>
				<Journal onNavigate={vi.fn()} />
			</TestWrapper>,
		);

		await waitFor(() => {
			const heading = screen.getByRole("heading", { name: "Journal" });
			expect(heading).toBeInTheDocument();
		});
	});

	it("renders page header icon with mode accent styling", async () => {
		render(
			<TestWrapper>
				<Journal onNavigate={vi.fn()} />
			</TestWrapper>,
		);

		await waitFor(() => {
			const icon = screen.getByTestId("page-header-icon");
			expect(icon).toBeInTheDocument();
			expect(icon).toHaveAttribute("aria-hidden", "true");
			expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
		});
	});

	it("icon and heading are rendered together in the header", async () => {
		render(
			<TestWrapper>
				<Journal onNavigate={vi.fn()} />
			</TestWrapper>,
		);

		await waitFor(() => {
			const icon = screen.getByTestId("page-header-icon");
			const heading = screen.getByRole("heading", { name: "Journal" });

			// Both should be in the document
			expect(icon).toBeInTheDocument();
			expect(heading).toBeInTheDocument();

			// They should share a common parent container
			const iconParent = icon.parentElement;
			const headingParent = heading.parentElement;
			expect(iconParent).toBe(headingParent);
		});
	});

});
