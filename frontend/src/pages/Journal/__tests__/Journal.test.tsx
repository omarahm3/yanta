import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogProvider, HelpProvider, HotkeyProvider, ProjectContext } from "../../../contexts";
import { Journal } from "../Journal";

// Mock Layout to render children only (sidebar/header tested elsewhere)
vi.mock("../../../components/Layout", () => ({
	Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../hooks/useSidebarSections", () => ({
	useSidebarSections: () => [],
}));

// Test wrapper with project context and hotkey provider
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

// Mock the journal service
vi.mock("../../../../bindings/yanta/internal/journal/wailsservice", () => ({
	GetActiveEntries: vi.fn(() =>
		Promise.resolve([
			{
				id: "abc123",
				content: "Fix the auth bug",
				tags: ["urgent", "backend"],
				created: "2026-01-30T09:15:00Z",
			},
			{
				id: "def456",
				content: "Call dentist",
				tags: [],
				created: "2026-01-30T11:30:00Z",
			},
		]),
	),
	GetAllActiveEntries: vi.fn(() => Promise.resolve([])),
	DeleteEntry: vi.fn(() => Promise.resolve()),
	RestoreEntry: vi.fn(() => Promise.resolve()),
	ListDates: vi.fn(() => Promise.resolve(["2026-01-28", "2026-01-30"])),
	ListAllDates: vi.fn(() => Promise.resolve([])),
	PromoteToDocument: vi.fn(() => Promise.resolve("projects/work/doc-123.json")),
}));

// Mock the project service
vi.mock("../../../../bindings/yanta/internal/project/service", () => ({
	ListActive: vi.fn(() =>
		Promise.resolve([
			{ id: "1", alias: "personal", name: "Personal" },
			{ id: "2", alias: "work", name: "Work" },
		]),
	),
}));

describe("Journal", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Reset the mock to return entries by default
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		(GetActiveEntries as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: "abc123",
				content: "Fix the auth bug",
				tags: ["urgent", "backend"],
				created: "2026-01-30T09:15:00Z",
			},
			{
				id: "def456",
				content: "Call dentist",
				tags: [],
				created: "2026-01-30T11:30:00Z",
			},
		]);
	});

	it("renders date picker", async () => {
		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			// Should show current date (formatted)
			expect(screen.getByRole("button", { name: /\d+,\s*\d{4}/ })).toBeInTheDocument();
		});
	});

	it("renders entry list", async () => {
		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
			expect(screen.getByText("Call dentist")).toBeInTheDocument();
		});
	});

	it("renders empty state when no entries", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);
		const mockGet = GetActiveEntries as ReturnType<typeof vi.fn>;
		mockGet.mockResolvedValue([]);

		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText(/no entries/i)).toBeInTheDocument();
		});
	});

	it("renders status bar with entry count", async () => {
		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText("2 entries")).toBeInTheDocument();
		});
	});

	it("shows selection controls in status bar when entries selected", async () => {
		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		});

		// Click the selection toggle on first entry
		const selectButtons = screen.getAllByRole("button", { name: /select/i });
		fireEvent.click(selectButtons[0]);

		await waitFor(() => {
			expect(screen.getByText("1 entry selected")).toBeInTheDocument();
			expect(screen.getByText("Clear")).toBeInTheDocument();
			expect(screen.getByText("Promote to Doc")).toBeInTheDocument();
			expect(screen.getByText("Delete")).toBeInTheDocument();
		});
	});

	it("navigates dates", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);

		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		});

		// Click previous day
		const prevButton = screen.getByLabelText("Previous day");
		fireEvent.click(prevButton);

		await waitFor(() => {
			expect(GetActiveEntries).toHaveBeenCalledTimes(2);
		});
	});

	it("deletes selected entries", async () => {
		const { DeleteEntry } = await import("../../../../bindings/yanta/internal/journal/wailsservice");

		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		});

		// Select an entry
		const selectButtons = screen.getAllByRole("button", { name: /select/i });
		fireEvent.click(selectButtons[0]);

		// Click delete in status bar
		await waitFor(() => {
			expect(screen.getByText("Delete")).toBeInTheDocument();
		});

		const deleteButton = screen.getByText("Delete");
		fireEvent.click(deleteButton);

		// Confirm dialog should appear
		await waitFor(() => {
			expect(screen.getByText("Delete Journal Entry")).toBeInTheDocument();
		});

		// Click Confirm in the dialog
		const confirmButton = screen.getByText("Confirm");
		fireEvent.click(confirmButton);

		await waitFor(() => {
			expect(DeleteEntry).toHaveBeenCalledWith("personal", expect.any(String), "abc123");
		});
	});

	it("shows project context in status bar", async () => {
		render(<Journal />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText("Context:")).toBeInTheDocument();
			// "personal" appears twice (header and status bar), use getAllByText
			const personalTexts = screen.getAllByText("personal");
			expect(personalTexts.length).toBeGreaterThan(0);
		});
	});

	it("loads journal for initialDate when provided", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);

		// Render with a specific initial date
		render(<Journal initialDate="2026-01-15" />, { wrapper: TestWrapper });

		await waitFor(() => {
			// Verify that GetActiveEntries was called with the initial date
			expect(GetActiveEntries).toHaveBeenCalledWith("personal", "2026-01-15");
		});
	});
});
