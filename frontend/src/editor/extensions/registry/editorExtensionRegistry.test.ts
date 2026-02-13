import { afterEach, describe, expect, it } from "vitest";
import {
	getAllEditorExtensions,
	removeEditorExtensions,
	setEditorExtensions,
} from "./editorExtensionRegistry";

const TEST_SOURCES = ["test.registry.a", "test.registry.b"];

afterEach(() => {
	for (const source of TEST_SOURCES) {
		removeEditorExtensions(source);
	}
});

describe("editorExtensionRegistry", () => {
	it("returns a stable snapshot reference when registry has not changed", () => {
		const first = getAllEditorExtensions();
		const second = getAllEditorExtensions();
		expect(second).toBe(first);
	});

	it("updates snapshot reference only when contributions change", () => {
		const before = getAllEditorExtensions();

		setEditorExtensions(TEST_SOURCES[0], [{ key: "ext-a" }]);
		const afterSet = getAllEditorExtensions();
		expect(afterSet).not.toBe(before);
		expect(getAllEditorExtensions()).toBe(afterSet);

		setEditorExtensions(TEST_SOURCES[1], [{ key: "ext-b" }]);
		const afterSecondSet = getAllEditorExtensions();
		expect(afterSecondSet).not.toBe(afterSet);
		expect(getAllEditorExtensions()).toBe(afterSecondSet);

		removeEditorExtensions(TEST_SOURCES[1]);
		const afterRemove = getAllEditorExtensions();
		expect(afterRemove).not.toBe(afterSecondSet);
		expect(getAllEditorExtensions()).toBe(afterRemove);
	});
});
