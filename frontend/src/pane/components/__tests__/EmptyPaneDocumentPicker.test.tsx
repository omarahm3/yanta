import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOpenDocumentInPane = vi.fn();
const mockSetActivePane = vi.fn();
const { mockListByProject } = vi.hoisted(() => ({
	mockListByProject: vi.fn((alias: string) => {
		if (alias === "proj") {
			return Promise.resolve([
				{ path: "proj/doc-1", title: "First Document", projectAlias: "proj", updated: new Date() },
				{ path: "proj/doc-2", title: "Second Document", projectAlias: "proj", updated: new Date() },
				{ path: "proj/alpha-note", title: "Alpha Note", projectAlias: "proj", updated: new Date() },
			]);
		}
		if (alias === "other") {
			return Promise.resolve([
				{ path: "other/doc-3", title: "Third Document", projectAlias: "other", updated: new Date() },
			]);
		}
		return Promise.resolve([]);
	}),
}));

let mockRecentDocs = [
	{
		path: "proj/doc-1",
		title: "First Document",
		projectAlias: "proj",
		lastOpened: Date.now() - 3600000,
	},
	{
		path: "proj/doc-2",
		title: "Second Document",
		projectAlias: "proj",
		lastOpened: Date.now() - 7200000,
	},
	{
		path: "other/doc-3",
		title: "Third Document",
		projectAlias: "other",
		lastOpened: Date.now() - 86400000,
	},
];

vi.mock("../../../shared/hooks/useRecentDocuments", () => ({
	useRecentDocuments: () => ({
		recentDocuments: mockRecentDocs,
		addRecentDocument: vi.fn(),
		removeRecentDocument: vi.fn(),
		clearRecentDocuments: vi.fn(),
	}),
}));

vi.mock("../../../pane", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../pane")>();
	return {
		...actual,
		usePaneLayout: () => ({
			openDocumentInPane: mockOpenDocumentInPane,
			setActivePane: mockSetActivePane,
			activePaneId: "pane-1",
		}),
	};
});

vi.mock("../../../project", () => ({
	useProjectContext: () => ({
		projects: [
			{ id: "1", alias: "proj", name: "Project" },
			{ id: "2", alias: "other", name: "Other" },
		],
	}),
}));

vi.mock("../../../shared/services/DocumentService", () => ({
	DocumentServiceWrapper: {
		listByProject: mockListByProject,
	},
}));

vi.mock("../../../utils/dateUtils", () => ({
	formatRelativeTimeFromTimestamp: () => "2h ago",
}));

import { EmptyPaneDocumentPicker } from "../EmptyPaneDocumentPicker";

async function renderPicker(
	props: Partial<React.ComponentProps<typeof EmptyPaneDocumentPicker>> = {},
) {
	const view = render(<EmptyPaneDocumentPicker paneId="pane-1" {...props} />);
	await waitFor(() => expect(mockListByProject).toHaveBeenCalledTimes(2));
	return view;
}

describe("EmptyPaneDocumentPicker", () => {
	beforeEach(() => {
		mockOpenDocumentInPane.mockClear();
		mockSetActivePane.mockClear();
		mockListByProject.mockClear();
		mockRecentDocs = [
			{
				path: "proj/doc-1",
				title: "First Document",
				projectAlias: "proj",
				lastOpened: Date.now() - 3600000,
			},
			{
				path: "proj/doc-2",
				title: "Second Document",
				projectAlias: "proj",
				lastOpened: Date.now() - 7200000,
			},
			{
				path: "other/doc-3",
				title: "Third Document",
				projectAlias: "other",
				lastOpened: Date.now() - 86400000,
			},
		];
	});

	it("renders search input and recent documents on mount", async () => {
		await renderPicker();

		expect(screen.getByPlaceholderText("Search documents...")).toBeInTheDocument();
		expect(screen.getByText("First Document")).toBeInTheDocument();
		expect(screen.getByText("Second Document")).toBeInTheDocument();
		expect(screen.getByText("Third Document")).toBeInTheDocument();
	});

	it("auto-focuses the search input", async () => {
		await renderPicker();

		const input = screen.getByPlaceholderText("Search documents...");
		expect(document.activeElement).toBe(input);
	});

	it("filters documents when typing in search", async () => {
		await renderPicker();

		const input = screen.getByPlaceholderText("Search documents...");
		fireEvent.change(input, { target: { value: "Alpha" } });

		await waitFor(() => {
			expect(screen.getByText("Alpha Note")).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.queryByText("First Document")).not.toBeInTheDocument();
		});
	});

	it("ArrowDown/ArrowUp navigates the list", async () => {
		const { container } = await renderPicker();
		const wrapper = container.firstChild as HTMLElement;

		// First item highlighted by default
		const buttons = screen.getAllByRole("button");
		expect(buttons[0].className).toContain("bg-accent/10");

		// ArrowDown highlights second item
		fireEvent.keyDown(wrapper, { key: "ArrowDown" });
		const buttonsAfterDown = screen.getAllByRole("button");
		expect(buttonsAfterDown[1].className).toContain("bg-accent/10");
		expect(buttonsAfterDown[0].className).not.toContain("bg-accent/10");

		// ArrowUp highlights first item again
		fireEvent.keyDown(wrapper, { key: "ArrowUp" });
		const buttonsAfterUp = screen.getAllByRole("button");
		expect(buttonsAfterUp[0].className).toContain("bg-accent/10");
	});

	it("Ctrl+N/Ctrl+P navigates the list", async () => {
		const { container } = await renderPicker();
		const wrapper = container.firstChild as HTMLElement;

		// Ctrl+N highlights second item
		fireEvent.keyDown(wrapper, { key: "n", ctrlKey: true });
		const buttonsAfterNext = screen.getAllByRole("button");
		expect(buttonsAfterNext[1].className).toContain("bg-accent/10");
		expect(buttonsAfterNext[0].className).not.toContain("bg-accent/10");

		// Ctrl+P highlights first item again
		fireEvent.keyDown(wrapper, { key: "p", ctrlKey: true });
		const buttonsAfterPrev = screen.getAllByRole("button");
		expect(buttonsAfterPrev[0].className).toContain("bg-accent/10");
	});

	it("Enter opens highlighted document in pane", async () => {
		const { container } = await renderPicker();
		const wrapper = container.firstChild as HTMLElement;

		fireEvent.keyDown(wrapper, { key: "Enter" });

		expect(mockOpenDocumentInPane).toHaveBeenCalledWith("pane-1", "proj/doc-1");
		expect(mockSetActivePane).toHaveBeenCalledWith("pane-1");
	});

	it("click opens document in pane", async () => {
		await renderPicker();

		fireEvent.click(screen.getByText("Second Document"));

		expect(mockOpenDocumentInPane).toHaveBeenCalledWith("pane-1", "proj/doc-2");
		expect(mockSetActivePane).toHaveBeenCalledWith("pane-1");
	});

	it("shows drag-over state when isDragOver is true", async () => {
		await renderPicker({ isDragOver: true });

		expect(screen.getByText("Drop to open here")).toBeInTheDocument();
		expect(screen.queryByPlaceholderText("Search documents...")).not.toBeInTheDocument();
	});

	it("shows empty state when no recent documents", async () => {
		mockRecentDocs = [];

		await renderPicker();

		expect(screen.getByText("No recent documents")).toBeInTheDocument();
	});
});
