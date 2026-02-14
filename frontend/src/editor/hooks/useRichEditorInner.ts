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
import { System } from "@wailsio/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractTitleFromBlocks } from "../../document/utils/documentUtils";
import { useProjectContext } from "../../project";
import { useNotification } from "../../shared/hooks";
import { useScale } from "../../shared/stores/scale.store";
import type { BlockNoteBlock } from "../../shared/types/Document";
import { uploadFile } from "../../shared/utils/assetUpload";
import { registerClipboardImagePlugin } from "../../shared/utils/clipboard";
import { computeContentHash } from "../../shared/utils/contentHash";
import { openExternalUrl } from "../../shared/utils/openExternalUrl";
import {
	useEditorBlockSpecs,
	useEditorExtensions,
	useEditorLifecycleHooks,
	useEditorSlashMenuItems,
	useEditorStyleSpecs,
	useEditorTipTapExtensions,
} from "../extensions/registry/editorExtensionRegistry";
import { RTLExtension } from "../extensions/rtl";
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
	const { error: notifyError } = useNotification();
	const { scale } = useScale();
	const pluginExtensions = useEditorExtensions() as any[];
	const pluginTipTapExtensions = useEditorTipTapExtensions();
	const pluginBlockSpecs = useEditorBlockSpecs();
	const pluginStyleSpecs = useEditorStyleSpecs();
	const pluginSlashMenuItems = useEditorSlashMenuItems();
	const pluginLifecycleHooks = useEditorLifecycleHooks();

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

	const schema = useMemo(
		() =>
			BlockNoteSchema.create().extend({
				blockSpecs: {
					...pluginBlockSpecs,
					codeBlock: createCodeBlockSpec(codeBlockOptions),
				},
				styleSpecs: pluginStyleSpecs,
			}),
		[pluginBlockSpecs, pluginStyleSpecs],
	);

	const pluginTipTapAggregateExtension = useMemo(() => {
		if (pluginTipTapExtensions.length === 0) {
			return null;
		}
		return createExtension({
			key: "yanta.plugin.tiptap.aggregate",
			tiptapExtensions: pluginTipTapExtensions,
		});
	}, [pluginTipTapExtensions]);

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
			...(pluginTipTapAggregateExtension ? [pluginTipTapAggregateExtension] : []),
			...(pluginExtensions as any[]),
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
			const readyTimeout = setTimeout(() => {
				setIsReady(true);
				if (onReady) onReady(editor);
			}, 50);
			return () => clearTimeout(readyTimeout);
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
		if (!editor || !isReady) return;

		const context = {
			editor,
			editable,
		};
		const cleanupFns: Array<() => void> = [];

		for (const hooks of pluginLifecycleHooks) {
			try {
				const cleanup = hooks.onEditorReady?.(context);
				if (typeof cleanup === "function") {
					cleanupFns.push(cleanup);
				}
			} catch (err) {
				console.error("[plugin] onEditorReady hook failed", err);
			}
		}

		return () => {
			for (let i = cleanupFns.length - 1; i >= 0; i -= 1) {
				try {
					cleanupFns[i]();
				} catch (err) {
					console.error("[plugin] editor lifecycle cleanup failed", err);
				}
			}
			for (const hooks of pluginLifecycleHooks) {
				try {
					hooks.onEditorDestroy?.(context);
				} catch (err) {
					console.error("[plugin] onEditorDestroy hook failed", err);
				}
			}
		};
	}, [editor, editable, isReady, pluginLifecycleHooks]);

	useEffect(() => {
		if (editor && editable && isReady && autoFocus) {
			const focusTimeout = setTimeout(() => {
				editor.focus();
			}, 0);
			return () => clearTimeout(focusTimeout);
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

	const openLinkExternally = useCallback(
		async (rawUrl: string) => {
			const result = await openExternalUrl(rawUrl);
			if (!result.ok) {
				notifyError("Couldn't open link in your default browser.");
			}
		},
		[notifyError],
	);

	useEffect(() => {
		if (!container) {
			return;
		}

		const handleLinkActivate = (event: MouseEvent) => {
			if (event.button !== 0 && event.button !== 1) {
				return;
			}

			const target = event.target;
			if (!(target instanceof Element)) {
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

			event.preventDefault();
			event.stopPropagation();
			void openLinkExternally(href);
		};

		container.addEventListener("click", handleLinkActivate, true);
		container.addEventListener("auxclick", handleLinkActivate, true);

		return () => {
			container.removeEventListener("click", handleLinkActivate, true);
			container.removeEventListener("auxclick", handleLinkActivate, true);
		};
	}, [container, openLinkExternally]);

	return {
		editor,
		isReady,
		scale,
		containerRefCallback,
		pluginSlashMenuItems,
	};
}
