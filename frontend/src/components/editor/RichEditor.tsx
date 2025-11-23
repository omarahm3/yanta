import React, { useEffect } from "react";
import "@blocknote/core/fonts/inter.css";
import type { BlockNoteEditor } from "@blocknote/core";
import {
	type Block,
	BlockNoteSchema,
	createBlockNoteExtension,
	createCodeBlockSpec,
	type PartialBlock,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { codeBlockOptions } from "@blocknote/code-block";
import { useProjectContext } from "../../contexts";
import { uploadFile } from "../../utils/assetUpload";
import "../../styles/blocknote-dark.css";
import "../../extensions/rtl/rtl.css";
import { Browser, System } from "@wailsio/runtime";
import { RTLExtension } from "../../extensions/rtl";
import { cn } from "../../lib/utils";
import type { BlockNoteBlock } from "../../types/Document";
import { registerClipboardImagePlugin } from "../../utils/clipboard";
import { extractTitleFromBlocks } from "../../utils/documentUtils";

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
		const [isLinux, setIsLinux] = React.useState(false);
		const [container, setContainer] = React.useState<HTMLDivElement | null>(null);

		const uploadFileFn = React.useCallback(
			async (file: File) => {
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
				},
			},
			extensions: [
				createBlockNoteExtension({
					key: "rtl",
					tiptapExtensions: [RTLExtension],
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

				currentBlocks.forEach((block: Block) => {
					if (block.type === "file" && block.props?.url && !convertedBlocksRef.current.has(block.id)) {
						const url = block.props.url as string;
						if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
							convertedBlocksRef.current.add(block.id);
							editor.updateBlock(block.id, {
								type: "image",
								props: {
									url: url,
								},
							});
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
					return;
				}

				onChange(currentBlocks);
				if (onTitleChange) {
					const title = extractTitleFromBlocks(currentBlocks as BlockNoteBlock[]);
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

		const openLinkExternally = React.useCallback(async (url: string) => {
			try {
				await Browser.OpenURL(url);
			} catch (_err) {
				window.open(url, "_blank", "noopener,noreferrer");
			}
		}, []);

		useEffect(() => {
			if (!container) {
				return;
			}

			const allowedProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

			const handleClick = (event: MouseEvent) => {
				if (event.defaultPrevented) {
					return;
				}
				if (event.type === "click" && event.button !== 0) {
					return;
				}
				if (event.type === "auxclick" && event.button !== 1) {
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
					resolvedUrl = new URL(anchor.href);
				} catch {
					return;
				}

				if (!allowedProtocols.has(resolvedUrl.protocol)) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				openLinkExternally(resolvedUrl.href);
			};

			container.addEventListener("click", handleClick);
			container.addEventListener("auxclick", handleClick);

			return () => {
				container.removeEventListener("click", handleClick);
				container.removeEventListener("auxclick", handleClick);
			};
		}, [container, openLinkExternally]);

		if (!editor || !isReady) {
			return <div ref={mergedRef} className={cn("h-full w-full", className)} />;
		}

		return (
			<div ref={mergedRef} className={cn("rich-editor flex-1 overflow-y-auto h-full", className)}>
				<BlockNoteView editor={editor} theme="dark" />
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
			if (isLoading) return { ready: false as const, blocks: [] as PartialBlock[] };
			if (!initialContent || initialContent.trim() === "") {
				return { ready: true as const, blocks: [createDefaultInitialBlock()] };
			}
			try {
				const parsed = JSON.parse(initialContent);
				const blocks: PartialBlock[] = Array.isArray(parsed) ? (parsed as PartialBlock[]) : [];
				if (blocks.length === 0 || blocks[0].type !== "heading" || blocks[0].props?.level !== 1) {
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
				<div ref={ref} className={cn("flex items-center justify-center h-full", className)}>
					<div className="text-text-dim">Loading document...</div>
				</div>
			);
		}

		const contentKey =
			docKey ?? (initialContent && initialContent.trim() !== "" ? "__content__" : "__empty__");

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
