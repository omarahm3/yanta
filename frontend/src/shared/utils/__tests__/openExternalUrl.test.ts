import { readFileSync } from "node:fs";
import path from "node:path";
import { Browser } from "@wailsio/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openExternalUrl, resolveExternalUrl } from "../openExternalUrl";

describe("openExternalUrl", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("resolves relative links against base URL", () => {
		const resolved = resolveExternalUrl("/docs", "https://example.com/app/page");
		expect(resolved?.href).toBe("https://example.com/docs");
	});

	it("rejects unsupported protocols", async () => {
		const result = await openExternalUrl("javascript:alert(1)");
		expect(result.ok).toBe(false);
		expect(Browser.OpenURL).not.toHaveBeenCalled();
	});

	it("opens supported URLs via Browser.OpenURL", async () => {
		const result = await openExternalUrl("https://example.com/path");
		expect(result.ok).toBe(true);
		expect(Browser.OpenURL).toHaveBeenCalledWith("https://example.com/path");
	});

	it("returns failure without falling back to window.open when Browser.OpenURL fails", async () => {
		vi.mocked(Browser.OpenURL).mockRejectedValueOnce(new Error("open failed"));
		const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		const result = await openExternalUrl("https://example.com/path");

		expect(result.ok).toBe(false);
		expect(windowOpenSpy).not.toHaveBeenCalled();
	});

	it("prevents window.open fallback in editor link-open paths", () => {
		const files = [
			path.resolve(process.cwd(), "src/editor/hooks/useRichEditorInner.ts"),
			path.resolve(process.cwd(), "src/editor/extensions/link-toolbar/index.tsx"),
		];

		for (const file of files) {
			const content = readFileSync(file, "utf8");
			expect(content).not.toContain("window.open(");
		}
	});
});
