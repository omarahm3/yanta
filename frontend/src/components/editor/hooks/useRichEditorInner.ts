import { codeBlockOptions } from "@blocknote/code-block";
import type { BlockNoteEditor } from "@blocknote/core";
import {
	type Block,
	BlockNoteSchema,
	createCodeBlockSpec,
	createExtension,
	type PartialBlock,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { Link } from "@tiptap/extension-link";
import { Browser, System } from "@wailsio/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectContext, useScale } from "../../../contexts";
import { RTLExtension } from "../../../extensions/rtl";
import type { BlockNoteBlock } from "../../../types/Document";
import { uploadFile } from "../../../utils/assetUpload";
import { registerClipboardImagePlugin } from "../../../utils/clipboard";
import { computeContentHash } from "../../../utils/contentHash";
import { extractTitleFromBlocks } from "../../../utils/documentUtils";
import { useBlockNoteMenuPosition } from "./useBlockNoteMenuPosition";
import { usePlainTextClipboard } from "./usePlainTextClipboard";

export interface UseRichEditorInnerProps {
	blocks: PartialBlock[];
	onChange?: (blocks: Block[]) => void;
	onTitleChange?: (title: string) => void;
	onReady?: (editor: BlockNoteEditor) => void;
	editable: boolean;
	autoFocus: boolean;
}

export function useRichEditorInner({
	blocks,
	onChange,
	onTitleChange,
	onReady,
	editable,
	autoFocus,
}: UseRichEditorInnerProps) {
	const { currentProject } = useProjectContext();
	const { scale } = useScale();

	useBlockNoteMenuPosition();

	const [isLinux, setIsLinux] = useState(false);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);

	usePlainTextClipboard(container);

	const hasEstablishedBaseline = useRef(false);
	const baselineHashRef = useRef<string | null>(null);
	const convertedBlocksRef = useRef<Set<string>>(new Set());

	const uploadFileFn = useCallback(
		async (file: File) => {
			console.warn("[RichEditor] uploadFileFn called by BlockNote!", {
				fileName: file.name,
				size: file.size,
			});
			const alias = currentProject?.alias ?? "";
			if (!alias) throw new Error("No project selected");
			return await uploadFile(file, alias);
		},
		[currentProject],
	);

	const schema = useRef(
		BlockNoteSchema.create().extend({
			blockSpecs: {
				codeBlock: createCodeBlockSpec(codeBlockOptions),
			},
		}),
	).current;

	const editor = useCreateBlockNote({
		schema,
		initialContent: blocks,
		uploadFile: uploadFileFn,
		domAttributes: {
			editor: {
				class: "bn-editor",
				"data-scale": "true",
			},
		},
		extensions: [
			createExtension({
				key: "rtl",
				tiptapExtensions: [RTLExtension],
			}),
			createExtension({
				key: "disableLinkClick",
				tiptapExtensions: [Link.extend({ inclusive: false }).configure({ openOnClick: false })],
			}),
		],
	});
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		if (!editor) return;

		let cancelled = false;

		const ensureImageAccept = async () => {
			try {
				const isLinuxPlatform = System.IsLinux();
				if (cancelled) return;

				setIsLinux(isLinuxPlatform);
				if (!isLinuxPlatform) {
					return;
				}

				const imageSpec = editor.schema.blockSpecs?.image;
				if (!imageSpec || !imageSpec.implementation) {
					return;
				}

				const meta = imageSpec.implementation.meta ?? {};
				const acceptList = Array.isArray(meta.fileBlockAccept)
					? meta.fileBlockAccept.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
					: [];

				if (acceptList.length === 0 || acceptList.every((entry) => entry === "*/*")) {
					imageSpec.implementation.meta = {
						...meta,
						fileBlockAccept: ["image/*"],
					};
				}
			} catch (err) {
				console.warn("[RichEditor] Failed to apply Linux image accept workaround", err);
			}
		};

		void ensureImageAccept();

		return () => {
			cancelled = true;
		};
	}, [editor]);

	useEffect(() => {
		if (editor) {
			setTimeout(() => {
				setIsReady(true);
				if (onReady) onReady(editor);
			}, 50);
		}
	}, [editor, onReady]);

	useEffect(() => {
		if (editor && isReady && !hasEstablishedBaseline.current) {
			const raf = requestAnimationFrame(() => {
				baselineHashRef.current = computeContentHash(editor.document);
				hasEstablishedBaseline.current = true;
				console.log("[RichEditor] Baseline established", {
					hash: baselineHashRef.current?.substring(0, 50),
				});
			});
			return () => cancelAnimationFrame(raf);
		}
	}, [editor, isReady]);

	useEffect(() => {
		if (editor && editable && isReady && autoFocus) {
			setTimeout(() => {
				editor.focus();
			}, 0);
		}
	}, [editor, editable, isReady, autoFocus]);

	useEffect(() => {
		if (!editor || !onChange) return;

		const unsubscribe = editor.onChange(() => {
			const currentBlocks = editor.document;

			let didModify = false;

			currentBlocks.forEach((block: Block) => {
				if (block.type === "file" && block.props?.url && !convertedBlocksRef.current.has(block.id)) {
					const url = block.props.url as string;
					if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
						convertedBlocksRef.current.add(block.id);
						editor.updateBlock(block.id, {
							type: "image",
							props: { url },
						});
						didModify = true;
					}
				}
			});

			const firstBlock = currentBlocks[0];
			const needsH1 =
				!firstBlock ||
				firstBlock.type !== "heading" ||
				(firstBlock.props as { level?: number })?.level !== 1;

			if (needsH1) {
				editor.insertBlocks(
					[{ type: "heading", props: { level: 1 }, content: [] }],
					currentBlocks[0],
					"before",
				);
				didModify = true;
			}

			if (didModify) {
				console.log("[RichEditor] onChange: didModify=true, skipping propagation");
				return;
			}

			if (!hasEstablishedBaseline.current) {
				console.log("[RichEditor] onChange: baseline not established, skipping");
				return;
			}

			const finalBlocks = editor.document;
			const currentHash = computeContentHash(finalBlocks);

			if (currentHash === baselineHashRef.current) {
				console.log("[RichEditor] onChange: hash matches baseline, skipping");
				return;
			}

			console.log("[RichEditor] onChange: PROPAGATING change", {
				baselineHash: baselineHashRef.current?.substring(0, 30),
				currentHash: currentHash.substring(0, 30),
			});
			onChange(finalBlocks);
			baselineHashRef.current = currentHash;

			if (onTitleChange) {
				const title = extractTitleFromBlocks(finalBlocks as BlockNoteBlock[]);
				onTitleChange(title);
			}
		});

		return unsubscribe;
	}, [editor, onChange, onTitleChange]);

	useEffect(() => {
		if (editor) editor.isEditable = editable;
	}, [editor, editable]);

	useEffect(() => {
		if (!editor || !isReady || !isLinux) {
			return;
		}

		const unregister = registerClipboardImagePlugin(editor, {
			shouldHandlePaste: () => editable,
			uploadFile: uploadFileFn,
		});

		return unregister;
	}, [editor, uploadFileFn, editable, isReady, isLinux]);

	const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
		setContainer(node);
	}, []);

	const openLinkExternally = useCallback((url: string) => {
		Browser.OpenURL(url).catch(() => {
			window.open(url, "_blank", "noopener,noreferrer");
		});
	}, []);

	const allowedProtocols = useRef(new Set(["http:", "https:", "mailto:", "tel:"])).current;

	useEffect(() => {
		if (!container) {
			return;
		}

		let isMounted = true;
		const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

		const handleMouseDown = (event: MouseEvent) => {
			if (event.button !== 0 && event.button !== 1) {
				return;
			}

			const target = event.target as HTMLElement | null;
			if (!target) {
				return;
			}

			const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
			if (!anchor || !container.contains(anchor)) {
				return;
			}

			const href = anchor.getAttribute("href");
			if (!href) {
				return;
			}

			let resolvedUrl: URL;
			try {
				resolvedUrl = new URL(href, window.location.href);
			} catch {
				return;
			}

			if (!allowedProtocols.has(resolvedUrl.protocol)) {
				return;
			}

			anchor.removeAttribute("href");
			anchor.setAttribute("data-href-temp", href);

			openLinkExternally(resolvedUrl.href);

			const timeoutId = setTimeout(() => {
				pendingTimeouts.delete(timeoutId);
				if (!isMounted) return;
				const tempHref = anchor.getAttribute("data-href-temp");
				if (tempHref) {
					anchor.setAttribute("href", tempHref);
					anchor.removeAttribute("data-href-temp");
				}
			}, 100);
			pendingTimeouts.add(timeoutId);
		};

		container.addEventListener("mousedown", handleMouseDown, true);

		return () => {
			isMounted = false;
			pendingTimeouts.forEach(clearTimeout);
			pendingTimeouts.clear();
			container.removeEventListener("mousedown", handleMouseDown, true);
		};
	}, [container, openLinkExternally]);

	return {
		editor,
		isReady,
		scale,
		containerRefCallback,
	};
}
