import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentPreview } from "../DocumentPreview";

describe("DocumentPreview", () => {
	it("renders document blocks as read-only HTML content", () => {
		const blocksJson = JSON.stringify([
			{
				id: "h",
				type: "heading",
				props: { level: 1 },
				content: [{ type: "text", text: "Books to read", styles: {} }],
			},
			{
				id: "p",
				type: "paragraph",
				content: [{ type: "text", text: "Clean Architecture", styles: {} }],
			},
		]);

		render(<DocumentPreview blocksJson={blocksJson} />);

		expect(screen.getByText("Books to read")).toBeInTheDocument();
		expect(screen.getByText("Clean Architecture")).toBeInTheDocument();
	});

	it("shows an empty state when the document has no blocks", () => {
		render(<DocumentPreview blocksJson="[]" />);
		expect(screen.getByText(/empty/i)).toBeInTheDocument();
	});
});
