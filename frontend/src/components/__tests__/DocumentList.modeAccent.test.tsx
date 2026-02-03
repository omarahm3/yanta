import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Document } from "../../types/Document";
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
	it("applies mode-accent styles to highlighted item via inline styles", () => {
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

		// Check that mode-accent CSS variable styles are applied
		expect(highlightedItem).toHaveStyle({
			borderLeftColor: "var(--mode-accent)",
			backgroundColor: "var(--mode-accent-muted)",
		});
	});

	it("applies mode-accent border style to selected item", () => {
		const document = buildDocument({ path: "doc-1", title: "Doc 1" });

		render(
			<DocumentList
				documents={[document]}
				onDocumentClick={vi.fn()}
				highlightedIndex={-1} // Not highlighted
				onHighlightDocument={vi.fn()}
				selectedDocuments={new Set(["doc-1"])}
				onToggleSelection={vi.fn()}
			/>,
		);

		const item = screen.getByRole("listitem");
		expect(item).toHaveStyle({
			borderLeftColor: "var(--mode-accent)",
		});
	});

	it("applies mode-accent color to selection toggle button when selected", () => {
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
		expect(toggle).toHaveStyle({
			borderColor: "var(--mode-accent)",
			color: "var(--mode-accent)",
		});
	});

	it("applies mode-accent color to index number when highlighted", () => {
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

		// Find the index span (contains "1.")
		const indexSpan = container.querySelector("span.font-mono");
		expect(indexSpan).toHaveStyle({ color: "var(--mode-accent)" });
	});
});
