import type { Document } from "../../types/Document";
import { preprocessCommand } from "../../utils/commandPreprocessor";

const makeDoc = (path: string): Document => ({
	path,
	projectAlias: "proj",
	title: path,
	blocks: [],
	tags: [],
	created: new Date(),
	updated: new Date(),
});

describe("preprocessCommand", () => {
	const documents: Document[] = [
		makeDoc("projects/proj/doc-1.json"),
		makeDoc("projects/proj/doc-2.json"),
		makeDoc("projects/proj/doc-3.json"),
	];

	it("fills selected document paths when archive has no args", () => {
		const selected = [documents[0].path, documents[2].path];
		const result = preprocessCommand("archive", documents, selected);
		expect(result).toBe(`archive ${documents[0].path},${documents[2].path}`);
	});

	it("fills selected document paths before --hard flag", () => {
		const selected = [documents[1].path];
		const result = preprocessCommand("delete --hard", documents, selected);
		expect(result).toBe(`delete ${documents[1].path} --hard`);
	});

	it("keeps original command when arguments already provided", () => {
		const selected = [documents[0].path];
		const result = preprocessCommand(`archive ${documents[2].path}`, documents, selected);
		expect(result).toBe(`archive ${documents[2].path}`);
	});

	it("converts numeric shortcuts when no selection", () => {
		const result = preprocessCommand("archive 2", documents);
		expect(result).toBe(`archive ${documents[1].path}`);
	});

	it("converts numeric shortcuts with --hard flag", () => {
		const result = preprocessCommand("delete 2 --hard", documents);
		expect(result).toBe(`delete ${documents[1].path} --hard`);
	});

	it("converts numeric shortcuts with --force --hard flags", () => {
		const result = preprocessCommand("delete 2 --force --hard", documents);
		expect(result).toBe(`delete ${documents[1].path} --force --hard`);
	});

	it("preserves --force flag when present", () => {
		const result = preprocessCommand("delete some/path --force", documents);
		expect(result).toBe("delete some/path --force");
	});

	describe("commands are trimmed by CommandLine.tsx, NOT by preprocessor", () => {
		it("should NOT trim commands - already trimmed by CommandLine", () => {
			const untrimmedCommand = "  archive 1  ";
			const result = preprocessCommand(untrimmedCommand, documents);
			expect(result).toContain("  ");
		});

		it("should preserve whitespace in non-expanded commands", () => {
			const command = "doc some/path ";
			const result = preprocessCommand(command, documents);
			expect(result).toBe("doc some/path ");
		});
	});

	describe("empty commands handled by CommandLine.tsx, NOT by preprocessor", () => {
		it("should NOT check for empty commands - returns input as-is", () => {
			const emptyCommand = "";
			const result = preprocessCommand(emptyCommand, documents);
			expect(result).toBe("");
		});

		it("should NOT check for whitespace-only commands", () => {
			const whitespaceCommand = "   ";
			const result = preprocessCommand(whitespaceCommand, documents);
			expect(result).toBe("   ");
		});
	});

	describe("--force is ONLY for bypassing confirmation, NOT required for --hard", () => {
		it("should allow delete with --hard WITHOUT --force", () => {
			const result = preprocessCommand("delete 1 --hard", documents);
			expect(result).toBe(`delete ${documents[0].path} --hard`);
			expect(result).not.toContain("--force");
		});

		it("should NOT add --force automatically to --hard commands", () => {
			const result = preprocessCommand("delete some/path --hard", documents);
			expect(result).toBe("delete some/path --hard");
			expect(result).not.toContain("--force");
		});

		it("should handle archive command without --force", () => {
			const result = preprocessCommand("archive 1", documents);
			expect(result).toBe(`archive ${documents[0].path}`);
			expect(result).not.toContain("--force");
		});

		it("should preserve --force on archive when provided", () => {
			const result = preprocessCommand("archive 1 --force", documents);
			expect(result).toBe(`archive ${documents[0].path} --force`);
		});
	});

	describe("--force works globally on ALL danger commands", () => {
		it("should work with archive command", () => {
			const result = preprocessCommand("archive 2 --force", documents);
			expect(result).toContain("--force");
			expect(result).toContain(documents[1].path);
		});

		it("should work with delete command (soft)", () => {
			const result = preprocessCommand("delete 1 --force", documents);
			expect(result).toContain("--force");
			expect(result).not.toContain("--hard");
		});

		it("should work with delete --hard command", () => {
			const result = preprocessCommand("delete 3 --force --hard", documents);
			expect(result).toContain("--force");
			expect(result).toContain("--hard");
		});

		it("should work with multiple paths and --force", () => {
			const result = preprocessCommand("delete 1,2,3 --force", documents);
			expect(result).toContain("--force");
			const paths = [documents[0].path, documents[1].path, documents[2].path];
			paths.forEach((path) => {
				expect(result).toContain(path);
			});
		});
	});

	describe("numeric shortcuts work with all flag combinations", () => {
		it("should expand multiple numeric shortcuts with flags", () => {
			const result = preprocessCommand("archive 1,3 --force", documents);
			expect(result).toContain(documents[0].path);
			expect(result).toContain(documents[2].path);
			expect(result).toContain("--force");
		});
	});

	describe("selected paths work with all flag combinations", () => {
		it("should fill selected paths with both --force and --hard", () => {
			const selected = [documents[2].path];
			const result = preprocessCommand("delete --force --hard", documents, selected);
			expect(result).toBe(`delete ${documents[2].path} --force --hard`);
		});
	});

	describe("commands without danger actions pass through unchanged", () => {
		it("should not modify doc command", () => {
			const result = preprocessCommand("doc some/path", documents);
			expect(result).toBe("doc some/path");
		});

		it("should not modify new command", () => {
			const result = preprocessCommand("new Document Title", documents);
			expect(result).toBe("new Document Title");
		});

		it("should not add --force to non-danger commands", () => {
			const result = preprocessCommand("rename doc.json newname", documents);
			expect(result).not.toContain("--force");
		});
	});

	describe("flag order should not matter", () => {
		it("should handle --hard --force (reverse order)", () => {
			const result = preprocessCommand("delete 1 --hard --force", documents);
			expect(result).toContain("--force");
			expect(result).toContain("--hard");
			expect(result).toContain(documents[0].path);
		});
	});
});
