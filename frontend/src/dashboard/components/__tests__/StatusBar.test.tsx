import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusBar } from "../StatusBar";

describe("StatusBar", () => {
	it("shows a glanceable doc count and project, each with a hover tooltip", () => {
		render(<StatusBar totalEntries={12} currentContext="Personal" />);

		// Value is glanceable; label is present but quiet.
		expect(screen.getByText("12")).toBeInTheDocument();
		expect(screen.getByText("Docs")).toBeInTheDocument();
		expect(screen.getByText("Personal")).toBeInTheDocument();
		expect(screen.getByText("Project")).toBeInTheDocument();

		// Informative-on-hover: native tooltips carry the spelled-out detail.
		expect(screen.getByTitle("12 documents")).toHaveTextContent("12");
		expect(screen.getByTitle("Project: Personal")).toHaveTextContent("Personal");
	});

	it("singularizes the doc-count tooltip", () => {
		render(<StatusBar totalEntries={1} currentContext="Work" />);
		expect(screen.getByTitle("1 document")).toBeInTheDocument();
	});

	it("surfaces a quiet archived badge only in archived view", () => {
		const { rerender } = render(<StatusBar totalEntries={3} currentContext="Personal" />);
		expect(screen.queryByText("Archived")).not.toBeInTheDocument();

		rerender(<StatusBar totalEntries={3} currentContext="Personal" showArchived />);
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("reveals selection actions and wires their handlers when documents are selected", () => {
		const onClearSelection = vi.fn();
		const onExportSelectedMarkdown = vi.fn();
		const onExportSelectedPDF = vi.fn();

		render(
			<StatusBar
				totalEntries={5}
				currentContext="Personal"
				selectedCount={2}
				onClearSelection={onClearSelection}
				onExportSelectedMarkdown={onExportSelectedMarkdown}
				onExportSelectedPDF={onExportSelectedPDF}
			/>,
		);

		expect(screen.getByText("2 documents selected")).toBeInTheDocument();

		fireEvent.click(screen.getByText("Clear Selection"));
		fireEvent.click(screen.getByText("Export MD"));
		fireEvent.click(screen.getByText("Export PDF"));

		expect(onClearSelection).toHaveBeenCalledTimes(1);
		expect(onExportSelectedMarkdown).toHaveBeenCalledTimes(1);
		expect(onExportSelectedPDF).toHaveBeenCalledTimes(1);
	});

	it("hides the selection row when nothing is selected", () => {
		render(<StatusBar totalEntries={5} currentContext="Personal" />);
		expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
	});
});
