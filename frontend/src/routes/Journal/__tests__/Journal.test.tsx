import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Journal } from "../Journal";

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
		])
	),
	DeleteEntry: vi.fn(() => Promise.resolve()),
	RestoreEntry: vi.fn(() => Promise.resolve()),
	ListDates: vi.fn(() => Promise.resolve(["2026-01-28", "2026-01-30"])),
	PromoteToDocument: vi.fn(() => Promise.resolve("projects/work/doc-123.json")),
}));

// Mock the project service
vi.mock("../../../../bindings/yanta/internal/project/service", () => ({
	ListActive: vi.fn(() =>
		Promise.resolve([
			{ id: "1", alias: "personal", name: "Personal" },
			{ id: "2", alias: "work", name: "Work" },
		])
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
		render(<Journal projectAlias="personal" />);

		await waitFor(() => {
			// Should show current date (formatted)
			expect(
				screen.getByRole("button", { name: /\d+,\s*\d{4}/ })
			).toBeInTheDocument();
		});
	});

	it("renders entry list", async () => {
		render(<Journal projectAlias="personal" />);

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

		render(<Journal projectAlias="personal" />);

		await waitFor(() => {
			expect(screen.getByText(/no entries/i)).toBeInTheDocument();
		});
	});

	it("allows multi-select for promote", async () => {
		render(<Journal projectAlias="personal" />);

		await waitFor(() => {
			expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		});

		// Enable selection mode
		const selectButton = screen.getByRole("button", { name: /select/i });
		fireEvent.click(selectButton);

		// Checkboxes should appear
		await waitFor(() => {
			expect(screen.getAllByRole("checkbox")).toHaveLength(2);
		});
	});

	it("shows promote dialog", async () => {
		render(<Journal projectAlias="personal" />);

		await waitFor(() => {
			expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		});

		// Enable selection mode
		const selectButton = screen.getByRole("button", { name: /select/i });
		fireEvent.click(selectButton);

		// Select an entry
		const checkboxes = screen.getAllByRole("checkbox");
		fireEvent.click(checkboxes[0]);

		// Click promote button
		const promoteButton = screen.getByRole("button", { name: /promote/i });
		fireEvent.click(promoteButton);

		await waitFor(() => {
			// Check for the dialog heading specifically
			expect(screen.getByRole("heading", { name: /move to document/i })).toBeInTheDocument();
		});
	});

	it("navigates dates", async () => {
		const { GetActiveEntries } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);

		render(<Journal projectAlias="personal" />);

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

	it("deletes entry with confirmation", async () => {
		const { DeleteEntry } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);

		render(<Journal projectAlias="personal" />);

		await waitFor(() => {
			expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
		});

		// Find and click delete button
		const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
		fireEvent.click(deleteButtons[0]);

		await waitFor(() => {
			expect(DeleteEntry).toHaveBeenCalledWith(
				"personal",
				expect.any(String),
				"abc123"
			);
		});
	});
});
