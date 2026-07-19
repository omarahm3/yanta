import { describe, expect, it } from "vitest";
import { exportBaseName } from "../useDocumentExports";

describe("exportBaseName", () => {
	it("keeps a normal title sanitized and lowercased", () => {
		expect(exportBaseName("My Diagram 2")).toBe("my_diagram_2");
	});

	it("collapses runs of separators and trims edges", () => {
		expect(exportBaseName("  Hello --- World!  ")).toBe("hello_world");
	});

	it("falls back to a default for an empty title (no bare dotfile)", () => {
		expect(exportBaseName("")).toBe("untitled");
		expect(exportBaseName("   ")).toBe("untitled");
	});

	it("falls back to a default for all-non-ASCII titles (no all-underscore name)", () => {
		expect(exportBaseName("日本語")).toBe("untitled");
		expect(exportBaseName("😀🎨")).toBe("untitled");
	});
});
