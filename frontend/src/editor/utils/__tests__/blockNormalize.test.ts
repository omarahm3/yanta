import { describe, expect, it } from "vitest";
import { isImageFileUrl, needsLeadingH1 } from "../blockNormalize";

describe("isImageFileUrl", () => {
	it("matches image extensions case-insensitively", () => {
		for (const url of ["/a/b.png", "x.JPG", "y.jpeg", "z.gif", "w.webp"]) {
			expect(isImageFileUrl(url)).toBe(true);
		}
	});

	it("rejects non-image files", () => {
		for (const url of ["doc.pdf", "archive.zip", "note.txt", "/no/extension", ""]) {
			expect(isImageFileUrl(url)).toBe(false);
		}
	});
});

describe("needsLeadingH1", () => {
	it("is true for an empty document", () => {
		expect(needsLeadingH1([])).toBe(true);
	});

	it("is true when the first block is not a level-1 heading", () => {
		expect(needsLeadingH1([{ type: "paragraph", props: {} }])).toBe(true);
		expect(needsLeadingH1([{ type: "heading", props: { level: 2 } }])).toBe(true);
		expect(needsLeadingH1([{ type: "heading", props: {} }])).toBe(true);
	});

	it("is false when the first block is a level-1 heading", () => {
		expect(needsLeadingH1([{ type: "heading", props: { level: 1 } }])).toBe(false);
	});
});
