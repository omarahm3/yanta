import type { BlockNoteEditor } from "@blocknote/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerClipboardImagePlugin } from "../clipboard";

type MockTiptapEditor = {
	isInitialized: boolean;
	isDestroyed: boolean;
	registerPlugin: ReturnType<typeof vi.fn>;
	unregisterPlugin: ReturnType<typeof vi.fn>;
};

function createEditor(tiptap?: Partial<MockTiptapEditor>): BlockNoteEditor {
	let tiptapEditor: MockTiptapEditor | undefined;
	if (tiptap) {
		const mutable = tiptap as MockTiptapEditor;
		mutable.isInitialized ??= false;
		mutable.isDestroyed ??= false;
		mutable.registerPlugin ??= vi.fn();
		mutable.unregisterPlugin ??= vi.fn();
		tiptapEditor = mutable;
	}

	return {
		isEditable: true,
		_tiptapEditor: tiptapEditor,
	} as unknown as BlockNoteEditor;
}

describe("registerClipboardImagePlugin", () => {
	let rafQueue: FrameRequestCallback[] = [];
	let rafId = 0;
	let rafSpy: ReturnType<typeof vi.spyOn>;
	let cancelRafSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		rafQueue = [];
		rafId = 0;
		rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			rafQueue.push(cb);
			rafId += 1;
			return rafId;
		});
		cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	it("retries registration until tiptap editor is initialized", () => {
		const tiptap: MockTiptapEditor = {
			isInitialized: false,
			isDestroyed: false,
			registerPlugin: vi.fn(),
			unregisterPlugin: vi.fn(),
		};
		const editor = createEditor(tiptap);

		const dispose = registerClipboardImagePlugin(editor, {
			shouldHandlePaste: () => true,
			uploadFile: vi.fn(async () => "https://example.com/image.png"),
		});

		expect(tiptap.registerPlugin).not.toHaveBeenCalled();
		expect(rafSpy).toHaveBeenCalledTimes(1);
		expect(rafQueue.length).toBe(1);

		tiptap.isInitialized = true;
		const callback = rafQueue.shift();
		expect(callback).toBeDefined();
		callback?.(performance.now());

		expect(tiptap.registerPlugin).toHaveBeenCalledTimes(1);

		dispose();
		expect(tiptap.unregisterPlugin).toHaveBeenCalledTimes(1);
	});

	it("retries when tiptap throws the pre-mount view error, then succeeds", () => {
		const tiptap: MockTiptapEditor = {
			isInitialized: true,
			isDestroyed: false,
			registerPlugin: vi
				.fn()
				.mockImplementationOnce(() => {
					throw new Error(
						"[tiptap error]: The editor view is not available. Cannot access view['dom']. The editor may not be mounted yet.",
					);
				})
				.mockImplementationOnce(() => undefined),
			unregisterPlugin: vi.fn(),
		};
		const editor = createEditor(tiptap);

		registerClipboardImagePlugin(editor, {
			shouldHandlePaste: () => true,
			uploadFile: vi.fn(async () => "https://example.com/image.png"),
		});

		expect(tiptap.registerPlugin).toHaveBeenCalledTimes(1);
		expect(rafQueue.length).toBe(1);

		const callback = rafQueue.shift();
		callback?.(performance.now());

		expect(tiptap.registerPlugin).toHaveBeenCalledTimes(2);
	});

	it("cancels pending RAF and skips unregister when plugin was never registered", () => {
		const tiptap: MockTiptapEditor = {
			isInitialized: false,
			isDestroyed: false,
			registerPlugin: vi.fn(),
			unregisterPlugin: vi.fn(),
		};
		const editor = createEditor(tiptap);

		const dispose = registerClipboardImagePlugin(editor, {
			shouldHandlePaste: () => true,
			uploadFile: vi.fn(async () => "https://example.com/image.png"),
		});

		expect(rafQueue.length).toBe(1);
		dispose();

		expect(cancelRafSpy).toHaveBeenCalledTimes(1);
		expect(tiptap.unregisterPlugin).not.toHaveBeenCalled();
	});

	it("returns noop when tiptap editor is missing", () => {
		const editor = createEditor();

		const dispose = registerClipboardImagePlugin(editor, {
			shouldHandlePaste: () => true,
			uploadFile: vi.fn(async () => "https://example.com/image.png"),
		});

		expect(typeof dispose).toBe("function");
		expect(rafSpy).not.toHaveBeenCalled();
	});
});
