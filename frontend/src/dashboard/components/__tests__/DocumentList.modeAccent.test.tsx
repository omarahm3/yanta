import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Document } from "../../../types/Document";
import { DocumentList } from "../DocumentList";

const buildDocument = (overrides: Partial<Document> = {}): Document => ({
	path: "doc-path",
	projectAlias: "project",
	title: "Untitled Document",
	blocks: [],
	tags: [],
	created: new Date("2024-01-01T00:00:00.000Z"),
	updated: new Date("2024-01-02T00:00:00.000Z"),
	...overrides,
});

describe("DocumentList mode-accent styling", () => {
	it("applies highlighted state to highlighted item via data attribute", () => {
		const documents = [
			buildDocument({ path: "doc-1", title: "Doc 1" }),
			buildDocument({ path: "doc-2", title: "Doc 2" }),
		];

		render(
			<DocumentList
				documents={documents}
				onDocumentClick={vi.fn()}
				highlightedIndex={0}
				onHighlightDocument={vi.fn()}
				selectedDocuments={new Set()}
				onToggleSelection={vi.fn()}
			/>,
		);

		const items = screen.getAllByRole("listitem");
		const highlightedItem = items[0];
		const nonHighlightedItem = items[1];

		expect(highlightedItem).toHaveAttribute("data-highlighted", "true");
		expect(nonHighlightedItem).toHaveAttribute("data-highlighted", "false");
	});

	it("applies selected state to selected item via data attribute", () => {
		const document = buildDocument({ path: "doc-1", title: "Doc 1" });

		render(
			<DocumentList
				documents={[document]}
				onDocumentClick={vi.fn()}
				highlightedIndex={-1}
				onHighlightDocument={vi.fn()}
				selectedDocuments={new Set(["doc-1"])}
				onToggleSelection={vi.fn()}
			/>,
		);

		const item = screen.getByRole("listitem");
		expect(item).toHaveAttribute("data-selected", "true");
		expect(item).toHaveAttribute("aria-selected", "true");
	});

	it("applies selected state to selection toggle button when selected", () => {
		const document = buildDocument({ path: "doc-1", title: "Doc 1" });

		render(
			<DocumentList
				documents={[document]}
				onDocumentClick={vi.fn()}
				highlightedIndex={0}
				onHighlightDocument={vi.fn()}
				selectedDocuments={new Set(["doc-1"])}
				onToggleSelection={vi.fn()}
			/>,
		);

		const toggle = screen.getByRole("button", { name: "Deselect Doc 1" });
		expect(toggle).toHaveAttribute("data-selected", "true");
		expect(toggle).toHaveAttribute("aria-pressed", "true");
	});

	it("renders index number with font-mono class when highlighted", () => {
		const document = buildDocument({ path: "doc-1", title: "Doc 1" });

		const { container } = render(
			<DocumentList
				documents={[document]}
				onDocumentClick={vi.fn()}
				highlightedIndex={0}
				onHighlightDocument={vi.fn()}
				selectedDocuments={new Set()}
				onToggleSelection={vi.fn()}
			/>,
		);

		const indexSpan = container.querySelector("span.font-mono");
		expect(indexSpan).toBeInTheDocument();
		expect(indexSpan).toHaveTextContent("1.");
	});
});
