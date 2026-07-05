import { describe, expect, it } from "vitest";
import { parseAppError, parseGitError } from "../gitErrorParser";

describe("parseGitError", () => {
	it("recognizes REBASE_CONFLICT and reassures the user their notes are safe", () => {
		const parsed = parseGitError(
			"REBASE_CONFLICT:\nRebase conflicts detected. Rebase was aborted; your working tree is unchanged.",
		);

		expect(parsed.type).toBe("CONFLICT");
		expect(parsed.title).toMatch(/conflict/i);
		expect(parsed.suggestions.length).toBeGreaterThan(0);
		// Raw output is preserved so the dialog's Copy button has something to copy.
		expect(parsed.technicalDetails).toContain("REBASE_CONFLICT");
	});
});

describe("parseAppError", () => {
	it("keeps recognized git errors git-flavored", () => {
		expect(parseAppError("REBASE_CONFLICT: something").type).toBe("CONFLICT");
	});

	it("wraps unknown / non-git errors as a neutral app error", () => {
		const parsed = parseAppError(new Error("Failed to save note"));

		expect(parsed.type).toBe("ERROR");
		expect(parsed.title).toBe("Something went wrong");
		expect(parsed.message).toContain("Failed to save note");
		expect(parsed.technicalDetails).toContain("Failed to save note");
	});

	it("strips a typed prefix from the summary line", () => {
		expect(parseAppError("SOME_CODE: boom happened").message).toBe("boom happened");
	});
});
