import { useCreateBlockNote } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerClipboardImagePlugin } from "../../../shared/utils/clipboard";

export interface BlockNoteTestDiagnostics {
	events: string[];
	imageCount: number;
	serialized: string;
	accept: string;
	reset: () => void;
}

export function useBlockNoteTestEditor(): {
	editor: ReturnType<typeof useCreateBlockNote>;
	diagnostics: BlockNoteTestDiagnostics;
} {
	const urlsRef = useRef<string[]>([]);
	const [events, setEvents] = useState<string[]>([]);
	const [imageCount, setImageCount] = useState<number>(0);
	const [serialized, setSerialized] = useState<string>("[]");

	const upload = useCallback(async (file: File) => {
		const url = URL.createObjectURL(file);
		urlsRef.current.push(url);
		console.info("[Test] BlockNote upload invoked", {
			name: file.name,
			type: file.type,
			size: file.size,
		});
		setEvents((prev) =>
			[`uploadFile(${file.type || "unknown"}, ${file.size} bytes)`, ...prev].slice(0, 10),
		);
		return url;
	}, []);

	const editor = useCreateBlockNote({
		uploadFile: upload,
	});
	const [accept, setAccept] = useState<string>("(pending)");

	useEffect(() => {
		if (!editor) {
			return;
		}

		return registerClipboardImagePlugin(editor, {
			shouldHandlePaste: () => true,
			uploadFile: upload,
			onInsert: ({ url, blockId, editor: editorInstance }) => {
				console.info("[Test] Plugin inserted pasted image", { url });
				try {
					editorInstance.updateBlock(blockId, {
						type: "image",
						props: { url },
					});
				} catch (error) {
					console.warn("[Test] Failed to convert file block to image", error);
				}
			},
		});
	}, [editor, upload]);

	useEffect(() => {
		if (!editor) return;
		const blockSpec = editor.schema.blockSpecs.image;
		if (blockSpec) {
			const meta = blockSpec.implementation.meta ?? {};
			if (
				!meta.fileBlockAccept ||
				(Array.isArray(meta.fileBlockAccept) &&
					meta.fileBlockAccept.filter((entry) => entry && entry.trim().length > 0).length === 0)
			) {
				console.warn(
					"[Test] BlockNote image block missing fileBlockAccept; forcing image/* for diagnostics",
				);
				blockSpec.implementation.meta = {
					...meta,
					fileBlockAccept: ["image/*"],
				};
			}
		}

		const acceptList = blockSpec?.implementation?.meta?.fileBlockAccept?.join(", ") ?? "";
		setAccept(acceptList || "(none)");
		console.info("[Test] BlockNote image block accept", {
			accept: acceptList,
		});

		const unsubscribe = editor.onChange(() => {
			const blocks = editor.document;
			const imageBlocks = blocks.filter((block) => block.type === "image").length;
			setImageCount(imageBlocks);
			try {
				setSerialized(JSON.stringify(blocks, null, 2));
			} catch (serializationError) {
				setSerialized(`Failed to serialise blocks: ${String(serializationError)}`);
			}
		});
		return unsubscribe;
	}, [editor]);

	useEffect(() => {
		return () => {
			urlsRef.current.forEach((url) => {
				URL.revokeObjectURL(url);
			});
			urlsRef.current = [];
		};
	}, []);

	const reset = useCallback(() => {
		setEvents([]);
		setImageCount(0);
		setSerialized("[]");
		urlsRef.current.forEach((url) => {
			URL.revokeObjectURL(url);
		});
		urlsRef.current = [];
	}, []);

	return {
		editor,
		diagnostics: { events, imageCount, serialized, accept, reset },
	};
}
