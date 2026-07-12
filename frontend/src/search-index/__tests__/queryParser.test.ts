import { describe, expect, it } from "vitest";
import { getFinderUnsupportedWarning, parseQuery, SEARCH_OPERATORS } from "../queryParser";

describe("queryParser — MRG-350", () => {
	it("parses project: filter", () => {
		const result = parseQuery("test project:@work");
		expect(result.projects).toEqual(["work"]);
		expect(result.text).toBe("test");
	});

	it("parses tag: filter", () => {
		const result = parseQuery("test tag:urgent");
		expect(result.tags).toEqual(["urgent"]);
		expect(result.text).toBe("test");
	});

	it("parses -exclude", () => {
		const result = parseQuery("test -draft");
		expect(result.excludes).toEqual(["draft"]);
		expect(result.text).toBe("test");
	});

	it("parses quoted phrases", () => {
		const result = parseQuery('test "exact phrase"');
		expect(result.phrases).toEqual(["exact phrase"]);
		expect(result.text).toBe("test");
	});

	it("identifies unsupported operators (title:, body:, AND, OR)", () => {
		const result = parseQuery("test title:foo body:bar AND baz OR qux");
		expect(result.unsupportedOperators).toContain("title:foo");
		expect(result.unsupportedOperators).toContain("body:bar");
		expect(result.unsupportedOperators).toContain("AND");
		expect(result.unsupportedOperators).toContain("OR");
	});

	it("returns null warning when no unsupported operators", () => {
		expect(getFinderUnsupportedWarning("test project:@work")).toBeNull();
	});

	it("returns warning message when unsupported operators present", () => {
		const warning = getFinderUnsupportedWarning("test title:foo");
		expect(warning).toContain("title:foo");
		expect(warning).toContain("not supported");
	});

	it("SEARCH_OPERATORS is exported and contains expected operators", () => {
		expect(SEARCH_OPERATORS).toContain("project:alias");
		expect(SEARCH_OPERATORS).toContain("tag:name");
		expect(SEARCH_OPERATORS).toContain("title:text");
		expect(SEARCH_OPERATORS).toContain("body:text");
	});
});
