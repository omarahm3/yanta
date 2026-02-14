import { afterEach, describe, expect, it } from "vitest";
import {
	getAllEditorBlockActions,
	getAllEditorBlockSpecs,
	getAllEditorExtensions,
	getAllEditorLifecycleHooks,
	getAllEditorSlashMenuItems,
	getAllEditorStyleSpecs,
	getAllEditorTipTapExtensions,
	getAllEditorTools,
	removeAllEditorPluginContributions,
	setEditorBlockActions,
	setEditorBlockSpecs,
	setEditorExtensions,
	setEditorLifecycleHooks,
	setEditorSlashMenuItems,
	setEditorStyleSpecs,
	setEditorTipTapExtensions,
	setEditorTools,
} from "./editorExtensionRegistry";

const TEST_SOURCES = ["test.registry.a", "test.registry.b"];

afterEach(() => {
	for (const source of TEST_SOURCES) {
		removeAllEditorPluginContributions(source);
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

		removeAllEditorPluginContributions(TEST_SOURCES[1]);
		const afterRemove = getAllEditorExtensions();
		expect(afterRemove).not.toBe(afterSecondSet);
		expect(getAllEditorExtensions()).toBe(afterRemove);
	});

	it("registers and removes generic editor contribution types", () => {
		setEditorTipTapExtensions(TEST_SOURCES[0], [{} as any]);
		setEditorBlockSpecs(TEST_SOURCES[0], { testBlock: {} } as any);
		setEditorStyleSpecs(TEST_SOURCES[0], { testStyle: {} } as any);
		setEditorSlashMenuItems(TEST_SOURCES[0], [
			{
				title: "Test Slash Item",
				aliases: ["test"],
				group: "Plugins",
				onItemClick: () => {},
			},
		]);
		setEditorTools(TEST_SOURCES[0], [
			{
				id: "tool-a",
				label: "Tool A",
				action: () => {},
			},
		]);
		setEditorBlockActions(TEST_SOURCES[0], [
			{
				id: "action-a",
				label: "Action A",
				action: () => {},
			},
		]);
		setEditorLifecycleHooks(TEST_SOURCES[0], {
			onEditorReady: () => {},
		});

		expect(getAllEditorTipTapExtensions()).toHaveLength(1);
		expect(Object.keys(getAllEditorBlockSpecs())).toContain("testBlock");
		expect(Object.keys(getAllEditorStyleSpecs())).toContain("testStyle");
		expect(getAllEditorSlashMenuItems()).toHaveLength(1);
		expect(getAllEditorTools()).toHaveLength(1);
		expect(getAllEditorBlockActions()).toHaveLength(1);
		expect(getAllEditorLifecycleHooks()).toHaveLength(1);

		removeAllEditorPluginContributions(TEST_SOURCES[0]);
		expect(getAllEditorTipTapExtensions()).toEqual([]);
		expect(getAllEditorBlockSpecs()).toEqual({});
		expect(getAllEditorStyleSpecs()).toEqual({});
		expect(getAllEditorSlashMenuItems()).toEqual([]);
		expect(getAllEditorTools()).toEqual([]);
		expect(getAllEditorBlockActions()).toEqual([]);
		expect(getAllEditorLifecycleHooks()).toEqual([]);
		expect(getAllEditorExtensions()).toEqual([]);
	});
});
