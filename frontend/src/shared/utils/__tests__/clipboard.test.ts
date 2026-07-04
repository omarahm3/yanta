import type { BlockNoteEditor } from "@blocknote/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ensureFileHasName,
	extractImagesFromClipboardEvent,
	registerClipboardImagePlugin,
	shouldAttemptImagePaste,
} from "../clipboard";

type ClipboardItemLike = { type: string; getAsFile: () => File | null };

function makeClipboardEvent(
	items: ClipboardItemLike[],
	files: File[] = [],
): ClipboardEvent {
	return {
		clipboardData: { items, files },
	} as unknown as ClipboardEvent;
}

function imageItem(type = "image/png"): ClipboardItemLike {
	return { type, getAsFile: () => new File([new Uint8Array([1, 2, 3])], "p.png", { type }) };
}

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

describe("ensureFileHasName (P3.1)", () => {
	it("keeps an existing name", () => {
		const file = new File([new Uint8Array([1])], "keep.png", { type: "image/png" });
		expect(ensureFileHasName(file).name).toBe("keep.png");
	});

	it("synthesizes a name from the MIME type when missing", () => {
		const file = new File([new Uint8Array([1])], "", { type: "image/jpeg" });
		const named = ensureFileHasName(file, 2);
		expect(named.name).toMatch(/^pasted-image-\d+-2\.jpg$/);
		expect(named.type).toBe("image/jpeg");
	});

	it("falls back to .bin for unknown MIME types", () => {
		const file = new File([new Uint8Array([1])], "", { type: "application/x-weird" });
		expect(ensureFileHasName(file).name).toMatch(/\.bin$/);
	});
});

describe("extractImagesFromClipboardEvent (P3.1)", () => {
	afterEach(() => {
		Reflect.deleteProperty(navigator, "clipboard");
	});

	it("returns none when there is no clipboardData", async () => {
		const result = await extractImagesFromClipboardEvent({} as ClipboardEvent);
		expect(result).toEqual({ files: [], source: "none" });
	});

	it("extracts image files from the DataTransfer items", async () => {
		const event = makeClipboardEvent([imageItem("image/png")]);
		const result = await extractImagesFromClipboardEvent(event);
		expect(result.source).toBe("data-transfer");
		expect(result.files).toHaveLength(1);
	});

	it("ignores non-image items", async () => {
		const textItem: ClipboardItemLike = { type: "text/plain", getAsFile: () => null };
		const event = makeClipboardEvent([textItem]);
		const result = await extractImagesFromClipboardEvent(event, { allowAsyncFallback: false });
		expect(result).toEqual({ files: [], source: "none" });
	});

	it("falls back to the async clipboard API when DataTransfer has no files (Wayland)", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				read: vi.fn(async () => [
					{
						types: ["image/png"],
						getType: async (t: string) => new Blob([new Uint8Array([1, 2])], { type: t }),
					},
				]),
			},
		});

		const event = makeClipboardEvent([]);
		const result = await extractImagesFromClipboardEvent(event, { allowAsyncFallback: true });
		expect(result.source).toBe("async-clipboard");
		expect(result.files).toHaveLength(1);
		expect(result.files[0].name).toMatch(/^pasted-image-/);
	});

	it("does not use the async fallback when disabled", async () => {
		const event = makeClipboardEvent([]);
		const result = await extractImagesFromClipboardEvent(event, { allowAsyncFallback: false });
		expect(result).toEqual({ files: [], source: "none" });
	});
});

describe("shouldAttemptImagePaste (P3.2)", () => {
	it("skips when the editor is not editable", () => {
		expect(shouldAttemptImagePaste(makeClipboardEvent([imageItem()]), false)).toBe(false);
	});

	it("skips when there is no clipboardData", () => {
		expect(shouldAttemptImagePaste({} as ClipboardEvent, true)).toBe(false);
	});

	it("skips when the browser already surfaced files (BlockNote handles those)", () => {
		const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
		expect(shouldAttemptImagePaste(makeClipboardEvent([imageItem()], [file]), true)).toBe(false);
	});

	it("skips a non-empty, non-image payload", () => {
		const textItem: ClipboardItemLike = { type: "text/plain", getAsFile: () => null };
		expect(shouldAttemptImagePaste(makeClipboardEvent([textItem]), true)).toBe(false);
	});

	it("attempts when an image item is present", () => {
		expect(shouldAttemptImagePaste(makeClipboardEvent([imageItem()]), true)).toBe(true);
	});

	it("attempts on an empty item list (Wayland async fallback)", () => {
		expect(shouldAttemptImagePaste(makeClipboardEvent([]), true)).toBe(true);
	});
});
