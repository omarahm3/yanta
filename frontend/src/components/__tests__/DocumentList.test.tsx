import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
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

describe("DocumentList", () => {
	it("highlights a document when hovered", () => {
		const onHighlightDocument = vi.fn();
		const documents = [
			buildDocument({ path: "doc-1", title: "Doc 1" }),
			buildDocument({ path: "doc-2", title: "Doc 2" }),
		];

		render(
			<DocumentList
				documents={documents}
				onDocumentClick={vi.fn()}
				highlightedIndex={0}
				onHighlightDocument={onHighlightDocument}
				selectedDocuments={new Set()}
				onToggleSelection={vi.fn()}
			/>,
		);

		const items = screen.getAllByRole("listitem");
		fireEvent.mouseEnter(items[1]);

		expect(onHighlightDocument).toHaveBeenCalledWith(1);
	});

	it("toggles selection through the selection button without triggering navigation", () => {
		const onToggleSelection = vi.fn();
		const onDocumentClick = vi.fn();
		const document = buildDocument({ path: "doc-1", title: "Doc 1" });

		render(
			<DocumentList
				documents={[document]}
				onDocumentClick={onDocumentClick}
				highlightedIndex={0}
				onHighlightDocument={vi.fn()}
				selectedDocuments={new Set()}
				onToggleSelection={onToggleSelection}
			/>,
		);

		const toggle = screen.getByRole("button", { name: "Select Doc 1" });
		fireEvent.click(toggle);

		expect(onToggleSelection).toHaveBeenCalledWith("doc-1");
		expect(onDocumentClick).not.toHaveBeenCalled();
	});

	it("marks selected documents via data-selected attribute for styling", () => {
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

		const item = screen.getByRole("listitem");
		expect(item).toHaveAttribute("data-selected", "true");
	});
});
