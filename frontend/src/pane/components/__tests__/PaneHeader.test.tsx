import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockLayout = {
	root: { type: "leaf" as const, id: "pane-1", documentPath: null },
	activePaneId: "pane-1",
	primaryDocumentPath: null,
};

vi.mock("../../../pane", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../pane")>();
	return {
		...actual,
		usePaneLayout: () => ({
			layout: mockLayout,
			activePaneId: "pane-1",
			splitPane: vi.fn(),
			closePane: vi.fn(),
		}),
	};
});

import { PaneHeader } from "../PaneHeader";

describe("PaneHeader", () => {
	it("shows 'Empty' when no documentPath and no title", () => {
		render(<PaneHeader paneId="pane-1" documentPath={null} />);
		expect(screen.getByText("Empty")).toBeInTheDocument();
	});

	it("shows title prop when provided", () => {
		render(<PaneHeader paneId="pane-1" documentPath="proj/doc.md" title="My Document" />);
		expect(screen.getByText("My Document")).toBeInTheDocument();
	});

	it("falls back to filename from path when no title prop", () => {
		render(<PaneHeader paneId="pane-1" documentPath="proj/my-note.md" />);
		expect(screen.getByText("my-note")).toBeInTheDocument();
	});

	it("prefers title prop over path-derived name", () => {
		render(<PaneHeader paneId="pane-1" documentPath="proj/old-name.md" title="Actual Title" />);
		expect(screen.getByText("Actual Title")).toBeInTheDocument();
		expect(screen.queryByText("old-name")).not.toBeInTheDocument();
	});
});
