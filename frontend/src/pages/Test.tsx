import type { BlockNoteEditor } from "@blocknote/core";
import {
	SuggestionMenuController,
	getDefaultReactSlashMenuItems,
	useCreateBlockNote,
	useBlockNoteEditor,
	ComponentsContext,
	type Components as BlockNoteComponents,
} from "@blocknote/react";
import {
	BlockNoteView as BlockNoteViewRaw,
	components as blockNoteComponents,
} from "@blocknote/shadcn";
import React from "react";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { mergeCSSClasses } from "@blocknote/core";
import { cn } from "../lib/utils";
import {
	type ClipboardImageSource,
	ensureFileHasName,
	extractImagesFromClipboardEvent,
	registerClipboardImagePlugin,
} from "../utils/clipboard";

interface TestProps {
	onNavigate?: (page: string) => void;
}

interface ResolvedFileInfo {
	name: string;
	size: number;
	type: string;
	lastModified: number;
	path?: string;
}

// Helper that serialises a File into displayable info without reading bytes.
const describeFile = (file: File, resolvedPath?: string): ResolvedFileInfo => ({
	name: file.name,
	size: file.size,
	type: file.type || "unknown",
	lastModified: file.lastModified,
	path: resolvedPath,
});

type BlockNoteDiagnostics = {
	events: string[];
	imageCount: number;
	serialized: string;
	accept: string;
	reset: () => void;
};

const useBlockNoteTestEditor = () => {
	const urlsRef = React.useRef<string[]>([]);
	const [events, setEvents] = React.useState<string[]>([]);
	const [imageCount, setImageCount] = React.useState<number>(0);
	const [serialized, setSerialized] = React.useState<string>("[]");

	const upload = React.useCallback(async (file: File) => {
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
	const [accept, setAccept] = React.useState<string>("(pending)");

	React.useEffect(() => {
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

	React.useEffect(() => {
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

	React.useEffect(() => {
		return () => {
			urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
			urlsRef.current = [];
		};
	}, []);

	const reset = React.useCallback(() => {
		setEvents([]);
		setImageCount(0);
		setSerialized("[]");
		urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
		urlsRef.current = [];
	}, []);

	return {
		editor,
		diagnostics: { events, imageCount, serialized, accept, reset },
	};
};

interface SimpleFileInputProps {
	className?: string;
	accept: string;
	value: File | null;
	placeholder: string;
	onChange: (payload: File | null) => void;
}

const SimpleFileInput = React.forwardRef<HTMLInputElement, SimpleFileInputProps>((props, ref) => {
	const { className, accept, placeholder, onChange } = props;
	const resolvedAccept = accept && accept.trim().length > 0 ? accept : "image/*";

	return (
		<input
			ref={ref}
			type="file"
			accept={resolvedAccept}
			title={placeholder}
			className={cn(
				"bn-plain-file-input block cursor-pointer rounded border border-border bg-bg-dark px-3 py-2 text-xs text-text hover:border-primary hover:text-text-bright",
				className,
			)}
			onChange={(event) => {
				const file = event.currentTarget.files?.[0] ?? null;
				console.info("[Test][override] plain input onChange", {
					accept: resolvedAccept,
					file: file ? { name: file.name, type: file.type, size: file.size } : "null",
				});
				onChange(file);
				event.currentTarget.value = "";
			}}
		/>
	);
});
SimpleFileInput.displayName = "SimpleFileInput";

const useFileInputDebug = (containerRef: React.RefObject<HTMLElement>, label: string) => {
	React.useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const trackedInputs = new Set<HTMLInputElement>();

		const handleChange = (event: Event) => {
			const input = event.currentTarget as HTMLInputElement;
			console.info(`[Test][${label}] change fired`, {
				accept: input.accept,
				files: input.files
					? Array.from(input.files).map((f) => ({
							name: f.name,
							type: f.type,
							size: f.size,
						}))
					: null,
			});
		};

		const handleClick = (event: Event) => {
			const input = event.currentTarget as HTMLInputElement;
			console.info(`[Test][${label}] click`, {
				accept: input.accept,
			});
		};

		const registerInput = (input: HTMLInputElement) => {
			if (trackedInputs.has(input)) return;
			trackedInputs.add(input);
			console.info(`[Test][${label}] file input registered`, {
				accept: input.accept,
				visibility: window.getComputedStyle(input).display,
			});
			input.addEventListener("change", handleChange);
			input.addEventListener("click", handleClick);
		};

		const unregisterAll = () => {
			trackedInputs.forEach((input) => {
				input.removeEventListener("change", handleChange);
				input.removeEventListener("click", handleClick);
			});
			trackedInputs.clear();
		};

		container.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(registerInput);

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLInputElement && node.type === "file") {
						registerInput(node);
					} else if (node instanceof HTMLElement) {
						node.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(registerInput);
					}
				});
			}
		});

		observer.observe(container, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			unregisterAll();
		};
	}, [containerRef, label]);
};

type BlockNoteViewWithComponentsProps = {
	componentsOverride: BlockNoteComponents;
	theme?: "light" | "dark";
	className?: string;
	editor: BlockNoteEditor;
	[key: string]: unknown;
};

const BlockNoteViewWithComponents: React.FC<BlockNoteViewWithComponentsProps> = ({
	componentsOverride,
	className,
	theme = "dark",
	...rest
}) => {
	return (
		<ComponentsContext.Provider value={componentsOverride}>
			<BlockNoteViewRaw data-theme={theme} className={className || ""} theme={theme} {...rest} />
		</ComponentsContext.Provider>
	);
};

export const Test: React.FC<TestProps> = () => {
	const [selectedInfo, setSelectedInfo] = React.useState<ResolvedFileInfo>();
	const [previewUrl, setPreviewUrl] = React.useState<string>();
	const [status, setStatus] = React.useState<string>("No file loaded");
	const [error, setError] = React.useState<string>();
	const [clipboardDebug, setClipboardDebug] = React.useState<{
		types: string[];
		itemTypes: string[];
		source: ClipboardImageSource | "none";
	}>({ types: [], itemTypes: [], source: "none" });

	const objectUrlRef = React.useRef<string>();
	const { editor: baselineBlockNoteEditor, diagnostics: baselineDiagnostics } =
		useBlockNoteTestEditor();
	const { editor: overrideBlockNoteEditor, diagnostics: overrideDiagnostics } =
		useBlockNoteTestEditor();
	const customComponents = React.useMemo<BlockNoteComponents>(() => {
		return {
			...blockNoteComponents,
			FilePanel: {
				...blockNoteComponents.FilePanel,
				FileInput: SimpleFileInput,
			},
		};
	}, []);

	const baselineContainerRef = React.useRef<HTMLDivElement>(null);
	const overrideContainerRef = React.useRef<HTMLDivElement>(null);

	useFileInputDebug(baselineContainerRef, "baseline");
	useFileInputDebug(overrideContainerRef, "override");

	const resetPreview = React.useCallback(() => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = undefined;
		}
		setPreviewUrl(undefined);
	}, []);

	const updateFromFile = React.useCallback(
		async (file: File) => {
			setError(undefined);
			resetPreview();
			setStatus("Reading file metadata...");

			setSelectedInfo(describeFile(file, undefined));

			if (file.type.startsWith("image/")) {
				const url = URL.createObjectURL(file);
				objectUrlRef.current = url;
				setPreviewUrl(url);
				setStatus("Image preview ready.");
			} else {
				setStatus("File loaded (non-image).");
			}
		},
		[resetPreview],
	);

	const handleFileInput = React.useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) {
				setSelectedInfo(undefined);
				resetPreview();
				setStatus("No file selected.");
				return;
			}
			await updateFromFile(file);
		},
		[updateFromFile, resetPreview],
	);

	const handlePaste = React.useCallback(
		async (event: React.ClipboardEvent<HTMLDivElement>) => {
			const { clipboardData } = event;
			const types = Array.from(clipboardData?.types || []);
			const itemTypes = Array.from(clipboardData?.items || []).map(
				(entry) => entry.type || entry.kind || "unknown",
			);

			const extraction = await extractImagesFromClipboardEvent(event.nativeEvent);

			setClipboardDebug({
				types,
				itemTypes,
				source: extraction.source,
			});

			if (extraction.files.length === 0) {
				setError("Clipboard paste does not contain an image payload.");
				return;
			}

			const namedFiles = extraction.files.map(ensureFileHasName);
			const firstFile = namedFiles[0];

			await updateFromFile(firstFile);
			setStatus(
				extraction.source === "async-clipboard"
					? "Image pasted using async clipboard fallback."
					: "Image pasted via DataTransfer.",
			);
		},
		[updateFromFile],
	);

	React.useEffect(() => {
		return () => {
			resetPreview();
		};
	}, [resetPreview]);

	return (
		<Layout currentPage="test" breadcrumb="Development Test Harness">
			<div className="h-full p-6 overflow-auto bg-bg-dark text-text">
				<div className="flex flex-col w-full max-w-3xl gap-6 mx-auto">
					<header className="space-y-2">
						<h1 className="text-xl font-semibold text-text-bright">Wayland File & Clipboard Test</h1>
						<p className="text-sm text-text-dim">
							This experimental page helps compare raw HTML pickers and clipboard handling against
							BlockNote&apos;s built-in UI. Use it to reproduce platform quirks without the rest of
							YANTA&apos;s editor layer.
						</p>
					</header>

					<section className="px-4 py-3 space-y-3 border rounded-md border-border bg-bg">
						<h2 className="text-base font-medium text-text-bright">File Picker</h2>
						<p className="text-xs text-text-dim">
							Uses a raw <code className="px-1 rounded bg-bg-dark">input[type="file"]</code> element with{" "}
							<code className="px-1 rounded bg-bg-dark">accept="image/*"</code>.
						</p>
						<input
							type="file"
							accept="image/*"
							onChange={handleFileInput}
							className="text-sm cursor-pointer text-text"
						/>
					</section>

					<section className="px-4 py-3 space-y-3 border rounded-md border-border bg-bg">
						<h2 className="text-base font-medium text-text-bright">Clipboard Paste</h2>
						<p className="text-xs text-text-dim">
							Focus the area below and press <kbd className="px-1 rounded bg-bg-dark">Ctrl</kbd>/
							<kbd className="px-1 rounded bg-bg-dark">Cmd</kbd>
							<span>+</span>
							<kbd className="px-1 rounded bg-bg-dark">V</kbd> with an image in your clipboard.
						</p>
						<div
							onPaste={handlePaste}
							className="flex items-center justify-center text-sm border border-dashed rounded outline-none h-36 border-border bg-bg-dark text-text-dim focus:border-primary focus:text-text"
						>
							Click here, then paste an image...
						</div>
					</section>

					<section className="px-4 py-3 space-y-3 border rounded-md border-border bg-bg">
						<h2 className="text-base font-medium text-text-bright">Status</h2>
						<div
							className={`rounded border px-4 py-2 text-sm ${
								error
									? "border-red-500 text-red-400"
									: previewUrl
										? "border-green-500 text-green-400"
										: "border-border text-text"
							}`}
						>
							{error ?? status}
						</div>
						<dl className="grid grid-cols-1 gap-2 text-xs text-text">
							<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
								<dt className="font-medium text-text-dim">Clipboard types</dt>
								<dd>{clipboardDebug.types.length ? clipboardDebug.types.join(", ") : "—"}</dd>
							</div>
							<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
								<dt className="font-medium text-text-dim">Item types</dt>
								<dd>{clipboardDebug.itemTypes.length ? clipboardDebug.itemTypes.join(", ") : "—"}</dd>
							</div>
							<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
								<dt className="font-medium text-text-dim">Image source</dt>
								<dd>{clipboardDebug.source === "none" ? "—" : clipboardDebug.source}</dd>
							</div>
						</dl>
						{selectedInfo && (
							<dl className="grid grid-cols-1 gap-2 text-xs text-text">
								<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
									<dt className="font-medium text-text-dim">Name</dt>
									<dd>{selectedInfo.name}</dd>
								</div>
								<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
									<dt className="font-medium text-text-dim">Type</dt>
									<dd>{selectedInfo.type}</dd>
								</div>
								<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
									<dt className="font-medium text-text-dim">Size</dt>
									<dd>{(selectedInfo.size / 1024).toFixed(2)} KB</dd>
								</div>
								{selectedInfo.path && (
									<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
										<dt className="font-medium text-text-dim">Resolved path</dt>
										<dd className="text-right truncate">{selectedInfo.path}</dd>
									</div>
								)}
							</dl>
						)}
						{previewUrl && (
							<div className="mt-2">
								<h3 className="text-sm font-medium text-text-bright">Preview</h3>
								<img
									src={previewUrl}
									alt="Preview"
									className="object-contain mt-2 border rounded max-h-64 border-border"
								/>
							</div>
						)}
					</section>

					<section className="px-4 py-3 space-y-3 border rounded-md border-border bg-bg">
						<h2 className="text-base font-medium text-text-bright">BlockNote (baseline configuration)</h2>
						<p className="text-xs text-text-dim">
							This embedded editor uses BlockNote without any YANTA-specific overrides. Pasted files are
							converted to object URLs via a local upload handler.
						</p>
						<div ref={baselineContainerRef} className="border rounded border-border">
							{baselineBlockNoteEditor ? (
								<BlockNoteViewRaw editor={baselineBlockNoteEditor} theme="dark" />
							) : (
								<div className="p-4 text-sm text-text-dim">Initialising editor…</div>
							)}
						</div>
						<div className="grid grid-cols-1 gap-2 text-xs text-text">
							<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Image block count</span>
								<span>{baselineDiagnostics.imageCount}</span>
							</div>
							<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Accept value</span>
								<span className="text-right">{baselineDiagnostics.accept}</span>
							</div>
							<div className="px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Upload events (latest first)</span>
								<ul className="mt-2 space-y-1">
									{baselineDiagnostics.events.length === 0 && (
										<li className="text-text-dim">No uploads recorded yet.</li>
									)}
									{baselineDiagnostics.events.map((entry, index) => (
										<li key={`${entry}-${index}`} className="font-mono text-[11px] text-text">
											{entry}
										</li>
									))}
								</ul>
							</div>
							<div className="px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Current document JSON</span>
								<pre className="mt-2 max-h-48 overflow-auto rounded bg-bg p-2 text-[11px] leading-tight text-text">
									{baselineDiagnostics.serialized}
								</pre>
							</div>
						</div>
					</section>

					<section className="px-4 py-3 space-y-3 border rounded-md border-border bg-bg">
						<h2 className="text-base font-medium text-text-bright">
							BlockNote (visible file input override)
						</h2>
						<p className="text-xs text-text-dim">
							Same editor instance, but the file picker uses a plain HTML input. This helps determine if
							the Wayland portal filtering problem comes from the library&apos;s hidden file input
							implementation.
						</p>
						<div ref={overrideContainerRef} className="border rounded border-border">
							{overrideBlockNoteEditor ? (
								<BlockNoteViewWithComponents
									editor={overrideBlockNoteEditor}
									theme="dark"
									componentsOverride={customComponents}
								/>
							) : (
								<div className="p-4 text-sm text-text-dim">Initialising editor…</div>
							)}
						</div>
						<div className="grid grid-cols-1 gap-2 text-xs text-text">
							<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Image block count</span>
								<span>{overrideDiagnostics.imageCount}</span>
							</div>
							<div className="flex items-center justify-between px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Accept value</span>
								<span className="text-right">{overrideDiagnostics.accept}</span>
							</div>
							<div className="px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Upload events (latest first)</span>
								<ul className="mt-2 space-y-1">
									{overrideDiagnostics.events.length === 0 && (
										<li className="text-text-dim">No uploads recorded yet.</li>
									)}
									{overrideDiagnostics.events.map((entry, index) => (
										<li key={`${entry}-${index}`} className="font-mono text-[11px] text-text">
											{entry}
										</li>
									))}
								</ul>
							</div>
							<div className="px-3 py-2 rounded bg-bg-dark">
								<span className="font-medium text-text-dim">Current document JSON</span>
								<pre className="mt-2 max-h-48 overflow-auto rounded bg-bg p-2 text-[11px] leading-tight text-text">
									{overrideDiagnostics.serialized}
								</pre>
							</div>
						</div>
					</section>

					<div className="flex items-center gap-3 text-xs text-text-dim">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setSelectedInfo(undefined);
								setError(undefined);
								setStatus("Cleared.");
								resetPreview();
								setClipboardDebug({ types: [], itemTypes: [], source: "none" });
								baselineDiagnostics.reset();
								overrideDiagnostics.reset();
							}}
						>
							Clear
						</Button>
					</div>
				</div>
			</div>
		</Layout>
	);
};
