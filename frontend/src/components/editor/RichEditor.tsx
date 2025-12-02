import React, { useEffect } from "react";
import "@blocknote/core/fonts/inter.css";
import type { BlockNoteEditor } from "@blocknote/core";
import {
	type Block,
	BlockNoteSchema,
	createExtension,
	createCodeBlockSpec,
	type PartialBlock,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { codeBlockOptions } from "@blocknote/code-block";
import { useProjectContext, useScale } from "../../contexts";
import { uploadFile } from "../../utils/assetUpload";
import "../../styles/blocknote-dark.css";
import "../../styles/blocknote-scale.css";
import "../../extensions/rtl/rtl.css";
import { Browser, System } from "@wailsio/runtime";
import { RTLExtension } from "../../extensions/rtl";
import { cn } from "../../lib/utils";
import type { BlockNoteBlock } from "../../types/Document";
import { registerClipboardImagePlugin } from "../../utils/clipboard";
import { extractTitleFromBlocks } from "../../utils/documentUtils";
import { computeContentHash } from "../../utils/contentHash";
import { useTableHandleMenuPositionFix, usePlainTextClipboard } from "./hooks";
import { Link } from "@tiptap/extension-link";
import { CustomLinkToolbarController } from "../../extensions/link-toolbar";

export interface RichEditorProps {
	initialContent?: string;
	onChange?: (blocks: Block[]) => void;
	onTitleChange?: (title: string) => void;
	onReady?: (editor: BlockNoteEditor) => void;
	className?: string;
	editable?: boolean;
	isLoading?: boolean;
	docKey?: string;
}

const createDefaultInitialBlock = (): PartialBlock => ({
	type: "heading",
	props: { level: 1 },
	content: [
		{
			type: "text",
			text: "",
			styles: {},
		},
	],
});

type EditorInnerProps = {
	blocks: PartialBlock[];
	onChange?: (blocks: Block[]) => void;
	onTitleChange?: (title: string) => void;
	onReady?: (editor: BlockNoteEditor) => void;
	className?: string;
	editable: boolean;
};

const EditorInner = React.forwardRef<HTMLDivElement, EditorInnerProps>(
	({ blocks, onChange, onTitleChange, onReady, className, editable }, ref) => {
		const { currentProject } = useProjectContext();
		const { scale } = useScale();

		useTableHandleMenuPositionFix();

		const [isLinux, setIsLinux] = React.useState(false);
		const [container, setContainer] = React.useState<HTMLDivElement | null>(
			null,
		);

		usePlainTextClipboard(container);

		const hasEstablishedBaseline = React.useRef(false);
		const baselineHashRef = React.useRef<string | null>(null);

		const uploadFileFn = React.useCallback(
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

		const schema = React.useMemo(
			() =>
				BlockNoteSchema.create().extend({
					blockSpecs: {
						codeBlock: createCodeBlockSpec(codeBlockOptions),
					},
				}),
			[],
		);

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
					tiptapExtensions: [
						Link.extend({ inclusive: false }).configure({ openOnClick: false }),
					],
				}),
			],
		});
		const [isReady, setIsReady] = React.useState(false);

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
						? meta.fileBlockAccept.filter(
								(entry) => typeof entry === "string" && entry.trim().length > 0,
							)
						: [];

					if (
						acceptList.length === 0 ||
						acceptList.every((entry) => entry === "*/*")
					) {
						imageSpec.implementation.meta = {
							...meta,
							fileBlockAccept: ["image/*"],
						};
					}
				} catch (err) {
					console.warn(
						"[RichEditor] Failed to apply Linux image accept workaround",
						err,
					);
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
			if (editor && editable && isReady) {
				setTimeout(() => {
					editor.focus();
				}, 0);
			}
		}, [editor, editable, isReady]);

		const convertedBlocksRef = React.useRef<Set<string>>(new Set());

		useEffect(() => {
			if (!editor || !onChange) return;

			const unsubscribe = editor.onChange(() => {
				const currentBlocks = editor.document;

				let didModify = false;

				currentBlocks.forEach((block: Block) => {
					if (
						block.type === "file" &&
						block.props?.url &&
						!convertedBlocksRef.current.has(block.id)
					) {
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
					console.log(
						"[RichEditor] onChange: didModify=true, skipping propagation",
					);
					return;
				}

				if (!hasEstablishedBaseline.current) {
					console.log(
						"[RichEditor] onChange: baseline not established, skipping",
					);
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

		const mergedRef = React.useCallback(
			(node: HTMLDivElement | null) => {
				setContainer(node);
				if (typeof ref === "function") {
					ref(node);
				} else if (ref) {
					(ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
				}
			},
			[ref],
		);

		const openLinkExternally = React.useCallback((url: string) => {
			Browser.OpenURL(url).catch(() => {
				window.open(url, "_blank", "noopener,noreferrer");
			});
		}, []);

		const allowedProtocols = React.useMemo(
			() => new Set(["http:", "https:", "mailto:", "tel:"]),
			[],
		);

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
		}, [container, openLinkExternally, allowedProtocols]);

		if (!editor || !isReady) {
			return <div ref={mergedRef} className={cn("h-full w-full", className)} />;
		}

		return (
			<div
				ref={mergedRef}
				className={cn("rich-editor flex-1 overflow-y-auto h-full", className)}
				style={{ "--editor-scale": scale } as React.CSSProperties}
			>
				<BlockNoteView editor={editor} theme="dark" linkToolbar={false}>
					<CustomLinkToolbarController />
				</BlockNoteView>
			</div>
		);
	},
);

EditorInner.displayName = "EditorInner";

export const RichEditor = React.forwardRef<HTMLDivElement, RichEditorProps>(
	(
		{
			initialContent,
			onChange,
			onTitleChange,
			onReady,
			className,
			editable = true,
			isLoading = false,
			docKey,
		},
		ref,
	) => {
		const parsed = React.useMemo(() => {
			if (isLoading)
				return { ready: false as const, blocks: [] as PartialBlock[] };
			if (!initialContent || initialContent.trim() === "") {
				return { ready: true as const, blocks: [createDefaultInitialBlock()] };
			}
			try {
				const parsed = JSON.parse(initialContent);
				const blocks: PartialBlock[] = Array.isArray(parsed)
					? (parsed as PartialBlock[])
					: [];
				if (
					blocks.length === 0 ||
					blocks[0].type !== "heading" ||
					blocks[0].props?.level !== 1
				) {
					return {
						ready: true as const,
						blocks: [createDefaultInitialBlock(), ...blocks],
					};
				}
				return { ready: true as const, blocks };
			} catch (e) {
				console.error("Failed to parse initial content:", e);
				return { ready: true as const, blocks: [createDefaultInitialBlock()] };
			}
		}, [initialContent, isLoading]);

		if (!parsed.ready) {
			return (
				<div
					ref={ref}
					className={cn("flex items-center justify-center h-full", className)}
				>
					<div className="text-text-dim">Loading document...</div>
				</div>
			);
		}

		const contentKey =
			docKey ??
			(initialContent && initialContent.trim() !== ""
				? "__content__"
				: "__empty__");

		return (
			<EditorInner
				ref={ref}
				key={contentKey}
				blocks={parsed.blocks}
				onChange={onChange}
				onTitleChange={onTitleChange}
				onReady={onReady}
				className={className}
				editable={editable}
			/>
		);
	},
);

RichEditor.displayName = "RichEditor";
