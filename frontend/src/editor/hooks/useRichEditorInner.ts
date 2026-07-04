import { codeBlockOptions } from "@blocknote/code-block";
import type { ExtensionFactoryInstance } from "@blocknote/core";
import {
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
import { useAppearanceStore } from "../../shared/stores/appearance.store";
import { useScale } from "../../shared/stores/scale.store";
import type { BlockNoteBlock } from "../../shared/types/Document";
import { uploadFile } from "../../shared/utils/assetUpload";
import {
	getImageBlockAcceptList,
	isEditorAlive,
	setImageBlockAccept,
} from "../../shared/utils/blocknoteInternals";
import { registerClipboardImagePlugin } from "../../shared/utils/clipboard";
import { computeContentHash } from "../../shared/utils/contentHash";
import { openExternalUrl } from "../../shared/utils/openExternalUrl";
import { CodeBlockFenceOnEnter } from "../extensions/codeBlockFence";
import {
	useEditorBlockSpecs,
	useEditorExtensions,
	useEditorLifecycleHooks,
	useEditorSlashMenuItems,
	useEditorStyleSpecs,
	useEditorTipTapExtensions,
} from "../extensions/registry/editorExtensionRegistry";
import { RTLExtension } from "../extensions/rtl";
import { UNKNOWN_BLOCK_TYPE, unknownBlockSpec } from "../extensions/unknownBlock";
import { type EditorHandle, fromEditorBlocks, toEditorHandle } from "../types";
import { isImageFileUrl, needsLeadingH1 } from "../utils/blockNormalize";
import { restoreUnknownBlocks, sanitizeUnknownBlocks } from "../utils/blockSanitize";
import { useBlockNoteMenuPosition } from "./useBlockNoteMenuPosition";
import { usePlainTextClipboard } from "./usePlainTextClipboard";

export interface UseRichEditorInnerProps {
	blocks: PartialBlock[];
	onChange?: (blocks: BlockNoteBlock[]) => void;
	onTitleChange?: (title: string) => void;
	onReady?: (editor: EditorHandle) => void;
	editable: boolean;
	autoFocus: boolean;
	disablePluginContributions?: boolean;
}

export function useRichEditorInner({
	blocks,
	onChange,
	onTitleChange,
	onReady,
	editable,
	autoFocus,
	disablePluginContributions = false,
}: UseRichEditorInnerProps) {
	const { currentProject } = useProjectContext();
	const { error: notifyError } = useNotification();
	const { scale } = useScale();
	const pluginExtensions = useEditorExtensions() as ExtensionFactoryInstance[];
	const pluginTipTapExtensions = useEditorTipTapExtensions();
	const pluginBlockSpecs = useEditorBlockSpecs();
	const pluginStyleSpecs = useEditorStyleSpecs();
	const pluginSlashMenuItems = useEditorSlashMenuItems();
	const pluginLifecycleHooks = useEditorLifecycleHooks();

	const effectivePluginExtensions = disablePluginContributions ? [] : pluginExtensions;
	const effectivePluginTipTapExtensions = disablePluginContributions ? [] : pluginTipTapExtensions;
	const effectivePluginBlockSpecs = disablePluginContributions ? {} : pluginBlockSpecs;
	const effectivePluginStyleSpecs = disablePluginContributions ? {} : pluginStyleSpecs;
	const effectivePluginSlashMenuItems = disablePluginContributions ? [] : pluginSlashMenuItems;
	const effectivePluginLifecycleHooks = disablePluginContributions ? [] : pluginLifecycleHooks;

	useBlockNoteMenuPosition();

	const [isLinux, setIsLinux] = useState(false);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const focusMode = useAppearanceStore((s) => s.focusMode);
	const toggleFocusMode = useAppearanceStore((s) => s.toggleFocusMode);

	usePlainTextClipboard(container);

	const hasEstablishedBaseline = useRef(false);
	const baselineHashRef = useRef<string | null>(null);
	const convertedBlocksRef = useRef<Set<string>>(new Set());

	const uploadFileFn = useCallback(
		async (file: File) => {
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
					...effectivePluginBlockSpecs,
					codeBlock: createCodeBlockSpec(codeBlockOptions),
					[UNKNOWN_BLOCK_TYPE]: unknownBlockSpec,
				},
				styleSpecs: effectivePluginStyleSpecs,
			}),
		[effectivePluginBlockSpecs, effectivePluginStyleSpecs],
	);

	const knownBlockTypes = useMemo(() => new Set(Object.keys(schema.blockSpecs)), [schema]);

	const sanitizedBlocks = useMemo(
		() => sanitizeUnknownBlocks(blocks, knownBlockTypes),
		[blocks, knownBlockTypes],
	);

	const pluginTipTapAggregateExtension = useMemo(() => {
		if (effectivePluginTipTapExtensions.length === 0) {
			return null;
		}
		return createExtension({
			key: "yanta.plugin.tiptap.aggregate",
			tiptapExtensions: effectivePluginTipTapExtensions,
		});
	}, [effectivePluginTipTapExtensions]);

	const editor = useCreateBlockNote({
		schema,
		initialContent: sanitizedBlocks,
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
				key: "codeBlockFenceOnEnter",
				tiptapExtensions: [
					// Typing ``` + Enter (optionally ```lang + Enter) converts the
					// paragraph into a code block. BlockNote's built-in input rule
					// only fires on space/tab, so Enter was doing nothing — this
					// restores the standard Markdown / Notion behavior users expect.
					CodeBlockFenceOnEnter.configure({
						defaultLanguage: codeBlockOptions.defaultLanguage ?? "text",
						resolveLanguage: (name: string): string => {
							const supported = codeBlockOptions.supportedLanguages ?? {};
							for (const [id, lang] of Object.entries(supported)) {
								const aliases = (lang as { aliases?: string[] }).aliases ?? [];
								if (id === name || aliases.includes(name)) return id;
							}
							return name;
						},
					}),
				],
			}),
			...(pluginTipTapAggregateExtension ? [pluginTipTapAggregateExtension] : []),
			...effectivePluginExtensions,
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

				const acceptList = getImageBlockAcceptList(editor);
				if (acceptList.length === 0 || acceptList.every((entry) => entry === "*/*")) {
					const applied = setImageBlockAccept(editor, ["image/*"]);
					if (!applied && import.meta.env.DEV) {
						console.warn(
							"[RichEditor] Image block internal shape not found; skipped Linux accept workaround",
						);
					}
				}
			} catch (err) {
				if (import.meta.env.DEV) {
					console.warn("[RichEditor] Failed to apply Linux image accept workaround", err);
				}
			}
		};

		void ensureImageAccept();

		return () => {
			cancelled = true;
		};
	}, [editor]);

	useEffect(() => {
		if (!editor) {
			return;
		}

		setIsReady(true);
		let cancelled = false;
		let rafId = 0;
		let attempts = 0;

		const notifyReady = () => {
			if (cancelled) {
				return;
			}

			const dom = editor.domElement;
			if (dom?.isConnected) {
				onReady?.(toEditorHandle(editor));
				return;
			}

			if (attempts < 10) {
				attempts += 1;
				rafId = requestAnimationFrame(notifyReady);
				return;
			}

			onReady?.(toEditorHandle(editor));
		};

		rafId = requestAnimationFrame(notifyReady);

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
		};
	}, [editor, onReady]);

	useEffect(() => {
		if (editor && isReady && !hasEstablishedBaseline.current) {
			const raf = requestAnimationFrame(() => {
				baselineHashRef.current = computeContentHash(fromEditorBlocks(editor.document));
				hasEstablishedBaseline.current = true;
			});
			return () => cancelAnimationFrame(raf);
		}
	}, [editor, isReady]);

	useEffect(() => {
		if (!editor || !isReady) return;

		const context = {
			editor: toEditorHandle(editor),
			editable,
		};
		const cleanupFns: Array<() => void> = [];

		for (const hooks of effectivePluginLifecycleHooks) {
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
			for (const hooks of effectivePluginLifecycleHooks) {
				try {
					hooks.onEditorDestroy?.(context);
				} catch (err) {
					console.error("[plugin] onEditorDestroy hook failed", err);
				}
			}
		};
	}, [editor, editable, isReady, effectivePluginLifecycleHooks]);

	useEffect(() => {
		if (editor && editable && isReady && autoFocus) {
			const focusTimeout = setTimeout(() => {
				const dom = editor.domElement;
				if (!dom || !dom.isConnected) {
					return;
				}

				try {
					editor.focus();
				} catch (err) {
					if (import.meta.env.DEV) {
						console.warn("[RichEditor] Failed to autofocus editor before mount", err);
					}
				}
			}, 0);
			return () => clearTimeout(focusTimeout);
		}
	}, [editor, editable, isReady, autoFocus]);

	useEffect(() => {
		if (!editor || !onChange) return;

		// Tiptap/BlockNote can fire one final onChange during the editor's
		// destroy phase (when <EditorInner key=...> remounts on doc switch).
		// If we mutate the editor there, we queue a transaction against a
		// torn-down view and Tiptap throws "view['posAtDOM']... not mounted yet".
		// isEditorAlive guards against that (see blocknoteInternals).
		const unsubscribe = editor.onChange(() => {
			if (!isEditorAlive(editor)) return;

			const currentBlocks = editor.document;

			let didModify = false;

			fromEditorBlocks(currentBlocks).forEach((block) => {
				if (block.type === "file" && block.props?.url && !convertedBlocksRef.current.has(block.id)) {
					const url = block.props.url as string;
					if (isImageFileUrl(url)) {
						convertedBlocksRef.current.add(block.id);
						if (!isEditorAlive(editor)) return;
						editor.updateBlock(block.id, {
							type: "image",
							props: { url },
						});
						didModify = true;
					}
				}
			});

			const needsH1 = needsLeadingH1(currentBlocks);

			if (needsH1) {
				if (!isEditorAlive(editor)) return;
				editor.insertBlocks(
					[{ type: "heading", props: { level: 1 }, content: [] }],
					currentBlocks[0],
					"before",
				);
				didModify = true;
			}

			if (didModify) {
				return;
			}

			if (!hasEstablishedBaseline.current) {
				return;
			}

			const finalBlocks = fromEditorBlocks(editor.document);
			const currentHash = computeContentHash(finalBlocks);

			if (currentHash === baselineHashRef.current) {
				return;
			}

			const restoredBlocks = restoreUnknownBlocks(finalBlocks);
			onChange(restoredBlocks);
			baselineHashRef.current = currentHash;

			if (onTitleChange) {
				const title = extractTitleFromBlocks(restoredBlocks);
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

		const unregister = registerClipboardImagePlugin(toEditorHandle(editor), {
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

	// Alt+Z toggles focus/typewriter mode (matches PANE_SHORTCUTS.focusMode)
	useEffect(() => {
		if (!container) return;
		const handleFocusModeKey = (e: KeyboardEvent) => {
			if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyZ") {
				e.preventDefault();
				toggleFocusMode();
			}
		};
		container.addEventListener("keydown", handleFocusModeKey, true);
		return () => container.removeEventListener("keydown", handleFocusModeKey, true);
	}, [container, toggleFocusMode]);

	return {
		editor,
		isReady,
		scale,
		focusMode,
		containerRefCallback,
		pluginSlashMenuItems: effectivePluginSlashMenuItems,
	};
}
