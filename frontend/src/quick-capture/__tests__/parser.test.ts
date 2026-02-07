import { describe, expect, it } from "vitest";
import { parse, parseContent, parseProject, parseTags } from "../parser";

describe("parser", () => {
	describe("parseTags", () => {
		it("extracts #tags from text", () => {
			expect(parseTags("Fix bug #urgent #backend")).toEqual(["urgent", "backend"]);
		});

		it("extracts tags at start of text", () => {
			expect(parseTags("#todo Fix this")).toEqual(["todo"]);
		});

		it("extracts tags at end of text", () => {
			expect(parseTags("Something important #priority")).toEqual(["priority"]);
		});

		it("returns empty array when no tags", () => {
			expect(parseTags("Just regular text")).toEqual([]);
		});

		it("ignores c# (no space before)", () => {
			expect(parseTags("Learning c# programming")).toEqual([]);
		});

		it("ignores f#sharp (no space before)", () => {
			expect(parseTags("F#sharp is functional")).toEqual([]);
		});

		it("ignores ## double hash", () => {
			expect(parseTags("## Heading")).toEqual([]);
		});

		it("handles tags with numbers", () => {
			expect(parseTags("Issue #bug123")).toEqual(["bug123"]);
		});

		it("handles tags with underscores", () => {
			expect(parseTags("Note #my_tag")).toEqual(["my_tag"]);
		});

		it("deduplicates repeated tags", () => {
			expect(parseTags("#urgent do it #urgent")).toEqual(["urgent"]);
		});
	});

	describe("parseProject", () => {
		it("extracts @project from text", () => {
			expect(parseProject("Note @work")).toBe("work");
		});

		it("extracts project at start of text", () => {
			expect(parseProject("@personal my thought")).toBe("personal");
		});

		it("returns null when no project", () => {
			expect(parseProject("Just regular text")).toBeNull();
		});

		it("ignores email@domain.com", () => {
			expect(parseProject("Contact me at test@example.com")).toBeNull();
		});

		it("handles multiple @project (last wins)", () => {
			expect(parseProject("Note @work then @personal")).toBe("personal");
		});

		it("handles project with hyphens", () => {
			expect(parseProject("Note @my-project")).toBe("my-project");
		});

		it("handles project with numbers", () => {
			expect(parseProject("Task @project123")).toBe("project123");
		});
	});

	describe("parseContent", () => {
		it("returns content without syntax markers", () => {
			expect(parseContent("Fix bug #urgent @work")).toBe("Fix bug");
		});

		it("trims whitespace", () => {
			expect(parseContent("  Fix bug #urgent  ")).toBe("Fix bug");
		});

		it("keeps content intact when no markers", () => {
			expect(parseContent("Just regular text")).toBe("Just regular text");
		});

		it("handles multiple tags and project", () => {
			expect(parseContent("Task #a #b #c @project")).toBe("Task");
		});

		it("preserves content between markers", () => {
			expect(parseContent("#start middle @end")).toBe("middle");
		});

		it("handles empty input", () => {
			expect(parseContent("")).toBe("");
		});

		it("handles only markers", () => {
			expect(parseContent("#tag @project")).toBe("");
		});
	});

	describe("parse (full)", () => {
		it("extracts all parts from full input", () => {
			const result = parse("Fix the auth bug #urgent #backend @work");
			expect(result.content).toBe("Fix the auth bug");
			expect(result.project).toBe("work");
			expect(result.tags).toEqual(["urgent", "backend"]);
		});

		it("handles input without markers", () => {
			const result = parse("Just a simple note");
			expect(result.content).toBe("Just a simple note");
			expect(result.project).toBeNull();
			expect(result.tags).toEqual([]);
		});

		it("handles only tags", () => {
			const result = parse("Task #urgent #todo");
			expect(result.content).toBe("Task");
			expect(result.project).toBeNull();
			expect(result.tags).toEqual(["urgent", "todo"]);
		});

		it("handles only project", () => {
			const result = parse("Note @personal");
			expect(result.content).toBe("Note");
			expect(result.project).toBe("personal");
			expect(result.tags).toEqual([]);
		});

		it("handles multiline content", () => {
			const result = parse("Line one\nLine two #tag @project");
			expect(result.content).toBe("Line one\nLine two");
			expect(result.project).toBe("project");
			expect(result.tags).toEqual(["tag"]);
		});
	});
});
