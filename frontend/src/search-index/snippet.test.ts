import { describe, expect, it } from "vitest";
import { buildSnippet } from "./snippet";

describe("buildSnippet", () => {
	it("highlights the matched term", () => {
		expect(buildSnippet("the system is great", ["system"])).toContain("<mark>system</mark>");
	});

	it("highlights case-insensitively while preserving original case", () => {
		expect(buildSnippet("The System", ["system"])).toContain("<mark>System</mark>");
	});

	it("escapes HTML in the source text (only <mark> is injected)", () => {
		const out = buildSnippet("a <script> tag & more", ["tag"]);
		expect(out).toContain("&lt;script&gt;");
		expect(out).toContain("&amp;");
		expect(out).not.toContain("<script>");
		expect(out).toContain("<mark>tag</mark>");
	});

	it("returns an ellipsised excerpt window around a deep match", () => {
		const long = `${"x ".repeat(120)}needle ${"y ".repeat(120)}`;
		const out = buildSnippet(long, ["needle"]);
		expect(out).toContain("<mark>needle</mark>");
		expect(out.startsWith("… ")).toBe(true);
		expect(out.endsWith(" …")).toBe(true);
	});

	it("falls back to the head when no term matches literally", () => {
		const out = buildSnippet("alpha beta gamma", ["zzz"]);
		expect(out).not.toContain("<mark>");
		expect(out).toContain("alpha");
	});

	it("returns empty string for empty text", () => {
		expect(buildSnippet("", ["x"])).toBe("");
	});
});
