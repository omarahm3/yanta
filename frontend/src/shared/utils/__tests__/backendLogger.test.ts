import { describe, expect, it } from "vitest";
import { formatLogArgs } from "../backendLogger";

describe("formatLogArgs", () => {
	it("serializes Error instances with name, message, and stack instead of '{}'", () => {
		const err = new Error("boom");
		const { message, data } = formatLogArgs(["[Boundary] Caught error:", err]);

		expect(message).toContain("boom");
		expect(message).toContain("Error");
		expect(data.error).toEqual(
			expect.objectContaining({
				name: "Error",
				message: "boom",
				stack: expect.stringContaining("boom"),
			}),
		);
	});

	it("keeps an Error that was passed inside a plain-object data field", () => {
		const err = new TypeError("bad type");
		const { data } = formatLogArgs([
			"[App] Uncaught error:",
			{ message: "x", filename: "f.js", error: err },
		]);

		expect(data.error).toEqual(
			expect.objectContaining({
				name: "TypeError",
				message: "bad type",
				stack: expect.any(String),
			}),
		);
		expect(data.filename).toBe("f.js");
	});

	it("handles a null event.error without throwing and leaves it null", () => {
		const { data } = formatLogArgs([
			"[App] Uncaught error:",
			{ message: "ResizeObserver loop", error: null },
		]);
		expect(data.error).toBeNull();
		expect(data.message).toBe("ResizeObserver loop");
	});

	it("serializes multiple Errors under error, error_1", () => {
		const a = new Error("first");
		const b = new Error("second");
		const { data } = formatLogArgs([a, b]);
		expect((data.error as { message: string }).message).toBe("first");
		expect((data.error_1 as { message: string }).message).toBe("second");
	});

	it("serializes Error.cause chain", () => {
		const root = new Error("root cause");
		const top = new Error("top", { cause: root });
		const { data } = formatLogArgs(["caught:", top]);
		const e = data.error as { message: string; cause: { message: string } };
		expect(e.message).toBe("top");
		expect(e.cause.message).toBe("root cause");
	});
});
