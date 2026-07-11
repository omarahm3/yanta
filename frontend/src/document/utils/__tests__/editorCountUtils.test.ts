import { describe, expect, it } from "vitest";
import { countWords, countChars } from "../editorCountUtils";

describe("countWords", () => {
	it("returns 0 for empty string", () => {
		expect(countWords("")).toBe(0);
	});

	it("returns 0 for whitespace-only string", () => {
		expect(countWords("   \n\t  ")).toBe(0);
	});

	it("counts single word", () => {
		expect(countWords("hello")).toBe(1);
	});

	it("counts multiple words separated by spaces", () => {
		expect(countWords("hello world foo bar")).toBe(4);
	});

	it("counts words separated by newlines", () => {
		expect(countWords("hello\nworld\nfoo")).toBe(3);
	});

	it("counts words separated by tabs", () => {
		expect(countWords("hello\tworld\tfoo")).toBe(3);
	});

	it("handles mixed whitespace", () => {
		expect(countWords("hello  \n\t world  foo")).toBe(3);
	});

	it("handles punctuation attached to words", () => {
		expect(countWords("hello, world! foo?")).toBe(3);
	});

	it("handles numbers as words", () => {
		expect(countWords("test 123 foo")).toBe(3);
	});

	it("handles hyphenated words as single word", () => {
		expect(countWords("well-known fact")).toBe(2);
	});
});

describe("countChars", () => {
	it("returns 0 for empty string", () => {
		expect(countChars("")).toBe(0);
	});

	it("counts characters including spaces", () => {
		expect(countChars("hello world")).toBe(11);
	});

	it("counts newlines", () => {
		expect(countChars("hello\nworld")).toBe(11);
	});

	it("counts tabs", () => {
		expect(countChars("hello\tworld")).toBe(11);
	});

	it("counts punctuation", () => {
		expect(countChars("hello, world!")).toBe(13);
	});
});
