import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the Vite configuration that keeps BlockNote loaded as a SINGLE module
 * instance. The "context split" bug (BlockNote loaded twice → broken React
 * context / slash-menu provider) was chased across 5 commits; these config
 * entries are what fixed it. This test fails loudly if a cleanup removes them.
 * See bnote-stable.md P0.1.
 */
const config = readFileSync(resolve(__dirname, "../../vite.config.ts"), "utf8");

describe("vite config: BlockNote single-instance guard", () => {
	it("dedupes the BlockNote runtime packages", () => {
		const dedupe = config.match(/dedupe:\s*\[([^\]]*)\]/)?.[1] ?? "";
		expect(dedupe).toContain("@blocknote/core");
		expect(dedupe).toContain("@blocknote/react");
	});

	it("pre-bundles all BlockNote packages together in optimizeDeps.include", () => {
		for (const pkg of [
			"@blocknote/react",
			"@blocknote/core",
			"@blocknote/shadcn",
			"@blocknote/code-block",
		]) {
			expect(config).toContain(pkg);
		}
	});

	it("keeps BlockNote in a single manual vendor chunk", () => {
		expect(config).toMatch(/"vendor-blocknote":\s*\[/);
	});
});
