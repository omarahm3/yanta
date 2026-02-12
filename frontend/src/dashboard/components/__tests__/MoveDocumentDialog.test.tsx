import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "../../../shared/types/Project";
import { MoveDocumentDialog } from "../MoveDocumentDialog";

const mockOpenDialog = vi.fn();
const mockCloseDialog = vi.fn();

vi.mock("../../../contexts/DialogContext", () => ({
	useDialog: () => ({
		isDialogOpen: false,
		openDialog: mockOpenDialog,
		closeDialog: mockCloseDialog,
	}),
}));

const mockProjects: Project[] = [
	{
		id: "p1",
		name: "Alpha Project",
		alias: "@alpha",
		startDate: "",
		createdAt: "",
		updatedAt: "",
	},
	{
		id: "p2",
		name: "Beta Project",
		alias: "@beta",
		startDate: "",
		createdAt: "",
		updatedAt: "",
	},
	{
		id: "p3",
		name: "Current Project",
		alias: "@current",
		startDate: "",
		createdAt: "",
		updatedAt: "",
	},
];

vi.mock("../../../contexts/ProjectContext", () => ({
	useProjectContext: () => ({
		projects: mockProjects,
		currentProject: mockProjects[2],
		isLoading: false,
		archivedProjects: [],
		loadProjects: vi.fn(),
		setCurrentProject: vi.fn(),
		previousProject: undefined,
		switchToLastProject: vi.fn(),
	}),
}));

const mockMoveDocumentToProject = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../shared/services/DocumentService", () => ({
	moveDocumentToProject: (...args: unknown[]) => mockMoveDocumentToProject(...args),
}));

describe("MoveDocumentDialog", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		documentPaths: ["projects/@current/doc-abc.json"],
		currentProjectAlias: "@current",
		onMoved: vi.fn(),
	};

	it("renders project list excluding current project", () => {
		render(<MoveDocumentDialog {...defaultProps} />);

		expect(screen.getByText("Alpha Project")).toBeInTheDocument();
		expect(screen.getByText("Beta Project")).toBeInTheDocument();
		expect(screen.queryByText("Current Project")).not.toBeInTheDocument();
	});

	it("filters projects by search input", () => {
		render(<MoveDocumentDialog {...defaultProps} />);

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.change(input, { target: { value: "alpha" } });

		expect(screen.getByText("Alpha Project")).toBeInTheDocument();
		expect(screen.queryByText("Beta Project")).not.toBeInTheDocument();
	});

	it("filters by alias too", () => {
		render(<MoveDocumentDialog {...defaultProps} />);

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.change(input, { target: { value: "@beta" } });

		expect(screen.queryByText("Alpha Project")).not.toBeInTheDocument();
		expect(screen.getByText("Beta Project")).toBeInTheDocument();
	});

	it("navigates with Ctrl+N and Ctrl+P", () => {
		render(<MoveDocumentDialog {...defaultProps} />);

		const input = screen.getByPlaceholderText("Search projects...");

		const buttons = screen.getAllByRole("button");
		const projectButtons = buttons.filter(
			(b) => b.textContent?.includes("Alpha") || b.textContent?.includes("Beta"),
		);
		expect(projectButtons[0]).toHaveClass("bg-accent/10");

		fireEvent.keyDown(input, { key: "n", ctrlKey: true });
		expect(projectButtons[1]).toHaveClass("bg-accent/10");

		fireEvent.keyDown(input, { key: "p", ctrlKey: true });
		expect(projectButtons[0]).toHaveClass("bg-accent/10");
	});

	it("confirms move with Enter", async () => {
		const onMoved = vi.fn();
		const onClose = vi.fn();
		render(<MoveDocumentDialog {...defaultProps} onMoved={onMoved} onClose={onClose} />);

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => {
			expect(mockMoveDocumentToProject).toHaveBeenCalledWith(
				"projects/@current/doc-abc.json",
				"@alpha",
			);
		});

		await waitFor(() => {
			expect(onMoved).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		});
	});

	it("handles multiple document paths (batch move)", async () => {
		const paths = [
			"projects/@current/doc-1.json",
			"projects/@current/doc-2.json",
			"projects/@current/doc-3.json",
		];
		const onMoved = vi.fn();
		const onClose = vi.fn();

		render(
			<MoveDocumentDialog
				{...defaultProps}
				documentPaths={paths}
				onMoved={onMoved}
				onClose={onClose}
			/>,
		);

		expect(screen.getByText("Move 3 Documents")).toBeInTheDocument();

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => {
			expect(mockMoveDocumentToProject).toHaveBeenCalledTimes(3);
			expect(mockMoveDocumentToProject).toHaveBeenCalledWith(paths[0], "@alpha");
			expect(mockMoveDocumentToProject).toHaveBeenCalledWith(paths[1], "@alpha");
			expect(mockMoveDocumentToProject).toHaveBeenCalledWith(paths[2], "@alpha");
		});
	});

	it("shows error on failure", async () => {
		mockMoveDocumentToProject.mockRejectedValueOnce(new Error("Network error"));

		render(<MoveDocumentDialog {...defaultProps} />);

		const input = screen.getByPlaceholderText("Search projects...");
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => {
			expect(screen.getByText("Network error")).toBeInTheDocument();
		});
	});

	it("calls openDialog/closeDialog for hotkey suppression", () => {
		const { rerender } = render(<MoveDocumentDialog {...defaultProps} />);

		expect(mockOpenDialog).toHaveBeenCalled();

		rerender(<MoveDocumentDialog {...defaultProps} isOpen={false} />);

		expect(mockCloseDialog).toHaveBeenCalled();
	});
});
