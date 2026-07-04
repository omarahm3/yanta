import { describe, expect, it } from "vitest";
import { resolveBlockDir } from "./textDirection";

describe("resolveBlockDir", () => {
	it("detects rtl for Arabic text when the current dir differs", () => {
		expect(resolveBlockDir("مرحبا", null)).toBe("rtl");
		expect(resolveBlockDir("مرحبا", "ltr")).toBe("rtl");
	});

	it("detects ltr for latin text when the current dir differs", () => {
		expect(resolveBlockDir("hello", null)).toBe("ltr");
		expect(resolveBlockDir("hello", "rtl")).toBe("ltr");
	});

	it("returns undefined (no change) when the direction already matches", () => {
		expect(resolveBlockDir("hello", "ltr")).toBeUndefined();
		expect(resolveBlockDir("مرحبا", "rtl")).toBeUndefined();
	});

	it("clears the dir of an emptied block that had one", () => {
		expect(resolveBlockDir("", "rtl")).toBeNull();
		expect(resolveBlockDir("   ", "ltr")).toBeNull();
	});

	it("leaves an empty block with no dir unchanged", () => {
		expect(resolveBlockDir("", null)).toBeUndefined();
		expect(resolveBlockDir("   ", null)).toBeUndefined();
	});

	it("does not change direction for neutral text (numbers/punctuation)", () => {
		expect(resolveBlockDir("123 !?", null)).toBeUndefined();
		expect(resolveBlockDir("123 !?", "ltr")).toBeUndefined();
	});
});
