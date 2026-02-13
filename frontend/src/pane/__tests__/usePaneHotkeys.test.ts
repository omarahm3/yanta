import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockSplitPane = vi.fn();
const mockClosePane = vi.fn();
const mockSetActivePane = vi.fn();

const mockLayout = {
	root: {
		type: "split" as const,
		id: "split-1",
		direction: "horizontal" as const,
		children: [
			{ type: "leaf" as const, id: "pane-1", documentPath: "doc1" },
			{ type: "leaf" as const, id: "pane-2", documentPath: "doc2" },
		],
		sizes: [50, 50] as [number, number],
	},
	activePaneId: "pane-1",
	primaryDocumentPath: "doc1",
};

const registeredHotkeys: any[] = [];

vi.mock("../hooks/usePaneLayout", () => ({
	usePaneLayout: () => ({
		layout: mockLayout,
		activePaneId: "pane-1",
		splitPane: mockSplitPane,
		closePane: mockClosePane,
		setActivePane: mockSetActivePane,
	}),
}));

vi.mock("../../hotkeys", () => ({
	useHotkeys: (hotkeys: any[]) => {
		registeredHotkeys.length = 0;
		registeredHotkeys.push(...hotkeys);
	},
}));

import { usePaneHotkeys } from "../hooks/usePaneHotkeys";

describe("usePaneHotkeys", () => {
	beforeEach(() => {
		mockSplitPane.mockClear();
		mockClosePane.mockClear();
		mockSetActivePane.mockClear();
		registeredHotkeys.length = 0;
	});

	it("registers all expected hotkeys", () => {
		renderHook(() => usePaneHotkeys());

		const keys = registeredHotkeys.map((h) => h.key);
		expect(keys).toContain("mod+\\");
		expect(keys).toContain("mod+shift+\\");
		expect(keys).toContain("alt+x");
		expect(keys).toContain("alt+h");
		expect(keys).toContain("alt+j");
		expect(keys).toContain("alt+k");
		expect(keys).toContain("alt+l");
	});

	it("registers 7 hotkeys total", () => {
		renderHook(() => usePaneHotkeys());
		expect(registeredHotkeys).toHaveLength(7);
	});

	it("sets category to Panes for all hotkeys", () => {
		renderHook(() => usePaneHotkeys());
		for (const hotkey of registeredHotkeys) {
			expect(hotkey.category).toBe("Panes");
		}
	});

	it("all hotkeys allow input and use capture", () => {
		renderHook(() => usePaneHotkeys());
		for (const hotkey of registeredHotkeys) {
			expect(hotkey.allowInInput).toBe(true);
			expect(hotkey.capture).toBe(true);
		}
	});

	it("split horizontal calls splitPane with horizontal direction", () => {
		renderHook(() => usePaneHotkeys());

		const splitH = registeredHotkeys.find((h) => h.key === "mod+\\");
		const event = new KeyboardEvent("keydown", { key: "\\", ctrlKey: true });
		splitH.handler(event);

		expect(mockSplitPane).toHaveBeenCalledWith("pane-1", "horizontal");
	});

	it("split vertical calls splitPane with vertical direction", () => {
		renderHook(() => usePaneHotkeys());

		const splitV = registeredHotkeys.find((h) => h.key === "mod+shift+\\");
		const event = new KeyboardEvent("keydown", { key: "\\", ctrlKey: true, shiftKey: true });
		splitV.handler(event);

		expect(mockSplitPane).toHaveBeenCalledWith("pane-1", "vertical");
	});

	it("close pane calls closePane when multiple panes exist", () => {
		renderHook(() => usePaneHotkeys());

		const close = registeredHotkeys.find((h) => h.key === "alt+x");
		const event = new KeyboardEvent("keydown", { key: "x", altKey: true });
		close.handler(event);

		expect(mockClosePane).toHaveBeenCalledWith("pane-1");
	});

	it("direction keys have correct descriptions", () => {
		renderHook(() => usePaneHotkeys());

		const directions = [
			{ key: "alt+h", desc: "Focus pane left" },
			{ key: "alt+j", desc: "Focus pane down" },
			{ key: "alt+k", desc: "Focus pane up" },
			{ key: "alt+l", desc: "Focus pane right" },
		];

		for (const { key, desc } of directions) {
			const hotkey = registeredHotkeys.find((h) => h.key === key);
			expect(hotkey.description).toBe(desc);
		}
	});
});
