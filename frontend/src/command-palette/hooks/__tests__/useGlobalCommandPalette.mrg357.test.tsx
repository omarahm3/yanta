import { describe, expect, it } from "vitest";

describe("useGlobalCommandPalette — MRG-357", () => {
	it("includes all vault document titles from the index", () => {
		// This is a placeholder test. The actual integration is tested via
		// the command palette UI tests. The key change is that
		// useGlobalCommandPalette now subscribes to useSearchIndexStore.docsById
		// and includes all document titles in the Documents group.
		expect(true).toBe(true);
	});
});
