// Helpers for extracting image payloads from clipboard paste events. WebKitGTK
// (Wayland) frequently omits entries from DataTransfer.files, so we fall back
// to the async Clipboard API when available.
import type { BlockNoteEditor } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";

const MIME_EXTENSION_FALLBACK: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/bmp": "bmp",
};

export type ClipboardImageSource = "data-transfer" | "async-clipboard";

export interface ClipboardImageExtraction {
	files: File[];
	source: ClipboardImageSource | "none";
}

export const ensureFileHasName = (file: File, index = 0): File => {
	if (file.name && file.name.trim().length > 0) {
		return file;
	}

	const extension = MIME_EXTENSION_FALLBACK[file.type] ?? "bin";
	const timestamp = Date.now();
	const safeName = `pasted-image-${timestamp}-${index}.${extension}`;
	return new File([file], safeName, {
		type: file.type,
		lastModified: timestamp,
	});
};

const extractFromDataTransfer = (dataTransfer: DataTransfer): File[] => {
	const files: File[] = [];
	const items = Array.from(dataTransfer.items || []);
	for (const item of items) {
		const type = item.type || "";
		if (!type.toLowerCase().startsWith("image/")) {
			continue;
		}
		const file = item.getAsFile();
		if (file) {
			files.push(file);
		}
	}
	return files;
};

const readUsingAsyncClipboard = async (): Promise<File[]> => {
	const asyncClipboard = navigator.clipboard as Clipboard & {
		read?: () => Promise<ClipboardItem[]>;
	};

	if (typeof asyncClipboard?.read !== "function") {
		return [];
	}

	try {
		const clipboardItems = await asyncClipboard.read();
		const gathered: File[] = [];
		let index = 0;

		for (const item of clipboardItems) {
			for (const type of item.types) {
				if (!type.toLowerCase().startsWith("image/")) {
					continue;
				}
				try {
					const blob = await item.getType(type);
					const file = new File([blob], "", {
						type,
						lastModified: Date.now(),
					});
					gathered.push(ensureFileHasName(file, index));
					index += 1;
				} catch (error) {
					console.warn("[clipboard] Failed to obtain blob from ClipboardItem", {
						type,
						error,
					});
				}
			}
		}

		return gathered;
	} catch (error) {
		console.warn("[clipboard] navigator.clipboard.read() failed", error);
		return [];
	}
};

export const extractImagesFromClipboardEvent = async (
	event: ClipboardEvent,
	options: { allowAsyncFallback?: boolean } = {},
): Promise<ClipboardImageExtraction> => {
	const clipboardData = event.clipboardData;
	if (!clipboardData) {
		return { files: [], source: "none" };
	}

	const transferFiles = extractFromDataTransfer(clipboardData);
	if (transferFiles.length > 0) {
		return { files: transferFiles, source: "data-transfer" };
	}

	if (options.allowAsyncFallback === false) {
		return { files: [], source: "none" };
	}

	const asyncFiles = await readUsingAsyncClipboard();
	if (asyncFiles.length > 0) {
		return { files: asyncFiles, source: "async-clipboard" };
	}

	return { files: [], source: "none" };
};

export interface ClipboardPluginOptions {
	shouldHandlePaste: () => boolean;
	uploadFile: (file: File) => Promise<string>;
	onInsert?: (details: {
		url: string;
		blockId: string;
		file: File;
		editor: BlockNoteEditor;
	}) => void;
}

export const registerClipboardImagePlugin = (
	editor: BlockNoteEditor,
	options: ClipboardPluginOptions,
) => {
	let isHandling = false;
	const pluginKey = new PluginKey("yantaClipboardImageFallback");

	const plugin = new Plugin({
		key: pluginKey,
		view(view) {
			const handlePaste = (event: ClipboardEvent) => {
				if (!options.shouldHandlePaste() || !editor.isEditable) {
					return;
				}

				if (!event.clipboardData) {
					return;
				}

				if (event.clipboardData.files?.length) {
					return;
				}

				const clipboardItems = Array.from(event.clipboardData.items || []);
				const hasImagePayload = clipboardItems.some((item) =>
					(item.type || "").toLowerCase().startsWith("image/"),
				);

				if (clipboardItems.length > 0 && !hasImagePayload) {
					return;
				}

				if (isHandling) {
					event.preventDefault();
					return;
				}

				event.preventDefault();
				isHandling = true;

				void (async () => {
					try {
						const extraction = await extractImagesFromClipboardEvent(event, {
							allowAsyncFallback: true,
						});

						if (extraction.files.length === 0) {
							return;
						}

						const namedFiles = extraction.files.map((file, index) => ensureFileHasName(file, index));

						for (const file of namedFiles) {
							try {
								const url = await options.uploadFile(file);

								const cursor = editor.getTextCursorPosition();
								const documentBlocks = editor.document;
								const fallbackBlockId =
									documentBlocks[documentBlocks.length - 1]?.id ?? documentBlocks[0]?.id;
								if (!fallbackBlockId) {
									console.warn("[clipboard] Unable to resolve insertion point for pasted image");
									continue;
								}

								const referenceBlockId = cursor?.block?.id ?? fallbackBlockId;
								const insertedBlocks = editor.insertBlocks(
									[
										{
											type: "file",
											props: {
												url,
												name: file.name,
												caption: "",
											},
										},
									],
									referenceBlockId,
									"after",
								);

								const lastInserted = insertedBlocks[insertedBlocks.length - 1];
								if (lastInserted) {
									editor.setTextCursorPosition(lastInserted.id, "end");
									options.onInsert?.({
										url,
										blockId: lastInserted.id,
										file,
										editor,
									});
								}
							} catch (error) {
								console.error("[clipboard] Failed to upload pasted image", error);
							}
						}
					} finally {
						isHandling = false;
					}
				})();
			};

			view.dom.addEventListener("paste", handlePaste, true);

			return {
				destroy() {
					view.dom.removeEventListener("paste", handlePaste, true);
				},
			};
		},
	});

	console.log("[clipboard] registering image paste plugin");

	editor._tiptapEditor.registerPlugin(plugin);

	console.log("[clipboard] image paste plugin registered");

	return () => {
		console.log("[clipboard] unregistering image paste plugin");
		editor._tiptapEditor.unregisterPlugin(pluginKey);
	};
};
