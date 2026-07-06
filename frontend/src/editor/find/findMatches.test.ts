import { type Node as PMNode, Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { findMatches } from "./findMatches";

// Minimal schema: paragraphs of inline text, a bold mark, and an inline atom
// (image) — enough to exercise marks and atom-breaking without pulling in the
// full BlockNote schema.
const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { group: "block", content: "inline*" },
		text: { group: "inline" },
		image: { group: "inline", inline: true, atom: true, attrs: { src: { default: "" } } },
	},
	marks: { bold: {} },
});

const p = (...inline: unknown[]) => schema.node("paragraph", null, inline as never);
const docOf = (...blocks: unknown[]) => schema.node("doc", null, blocks as never);
const bold = (t: string) => schema.text(t, [schema.mark("bold")]);
const img = () => schema.node("image", { src: "x.png" });

/** The text a match points at, for assertion without hardcoding positions. */
const textAt = (doc: PMNode, m: { from: number; to: number }) => doc.textBetween(m.from, m.to);

describe("findMatches", () => {
	it("finds all occurrences in document order", () => {
		const doc = docOf(p(schema.text("the system runs another system")));
		const matches = findMatches(doc, "system");
		expect(matches).toHaveLength(2);
		expect(matches.map((m) => textAt(doc, m))).toEqual(["system", "system"]);
		expect(matches[0].from).toBeLessThan(matches[1].from);
	});

	it("is case-insensitive by default (and points at original-case text)", () => {
		const doc = docOf(p(schema.text("The System Design")));
		const matches = findMatches(doc, "system");
		expect(matches).toHaveLength(1);
		expect(textAt(doc, matches[0])).toBe("System");
	});

	it("respects caseSensitive", () => {
		const doc = docOf(p(schema.text("system System SYSTEM")));
		expect(findMatches(doc, "System", { caseSensitive: true })).toHaveLength(1);
		expect(findMatches(doc, "system", { caseSensitive: false })).toHaveLength(3);
	});

	it("matches across mark boundaries within a block", () => {
		// "he" + bold "ll" + "o" = "hello"
		const doc = docOf(p(schema.text("he"), bold("ll"), schema.text("o")));
		const matches = findMatches(doc, "hello");
		expect(matches).toHaveLength(1);
		expect(textAt(doc, matches[0])).toBe("hello");
	});

	it("does not match across an inline atom", () => {
		// "ab" [image] "cd" — "bc" straddles the atom and must NOT match.
		const doc = docOf(p(schema.text("ab"), img(), schema.text("cd")));
		expect(findMatches(doc, "bc")).toHaveLength(0);
		expect(findMatches(doc, "ab")).toHaveLength(1);
		expect(findMatches(doc, "cd")).toHaveLength(1);
	});

	it("finds matches spread across multiple blocks", () => {
		const doc = docOf(p(schema.text("first system")), p(schema.text("second system")));
		expect(findMatches(doc, "system")).toHaveLength(2);
	});

	it("returns nothing for an empty query or no match", () => {
		const doc = docOf(p(schema.text("hello world")));
		expect(findMatches(doc, "")).toEqual([]);
		expect(findMatches(doc, "zzz")).toEqual([]);
	});
});
