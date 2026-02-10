import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ClipboardImageSource,
	ensureFileHasName,
	extractImagesFromClipboardEvent,
} from "../../../utils/clipboard";
import { useBlockNoteTestEditor } from "./useBlockNoteTestEditor";
import { useFileInputDebug } from "./useFileInputDebug";

export interface ResolvedFileInfo {
	name: string;
	size: number;
	type: string;
	lastModified: number;
	path?: string;
}

export function describeFile(file: File, resolvedPath?: string): ResolvedFileInfo {
	return {
		name: file.name,
		size: file.size,
		type: file.type || "unknown",
		lastModified: file.lastModified,
		path: resolvedPath,
	};
}

export interface ClipboardDebugState {
	types: string[];
	itemTypes: string[];
	source: ClipboardImageSource | "none";
}

export function useTestPageController() {
	const [selectedInfo, setSelectedInfo] = useState<ResolvedFileInfo | undefined>();
	const [previewUrl, setPreviewUrl] = useState<string>();
	const [status, setStatus] = useState<string>("No file loaded");
	const [error, setError] = useState<string>();
	const [clipboardDebug, setClipboardDebug] = useState<ClipboardDebugState>({
		types: [],
		itemTypes: [],
		source: "none",
	});

	const objectUrlRef = useRef<string>();
	const { editor: baselineBlockNoteEditor, diagnostics: baselineDiagnostics } =
		useBlockNoteTestEditor();
	const { editor: overrideBlockNoteEditor, diagnostics: overrideDiagnostics } =
		useBlockNoteTestEditor();

	const baselineContainerRef = useRef<HTMLDivElement>(null);
	const overrideContainerRef = useRef<HTMLDivElement>(null);

	useFileInputDebug(baselineContainerRef, "baseline");
	useFileInputDebug(overrideContainerRef, "override");

	const resetPreview = useCallback(() => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = undefined;
		}
		setPreviewUrl(undefined);
	}, []);

	const updateFromFile = useCallback(
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

	const handleFileInput = useCallback(
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

	const handlePaste = useCallback(
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

	const handleClear = useCallback(() => {
		setSelectedInfo(undefined);
		setError(undefined);
		setStatus("Cleared.");
		resetPreview();
		setClipboardDebug({ types: [], itemTypes: [], source: "none" });
		baselineDiagnostics.reset();
		overrideDiagnostics.reset();
	}, [resetPreview, baselineDiagnostics, overrideDiagnostics]);

	useEffect(() => {
		return () => {
			resetPreview();
		};
	}, [resetPreview]);

	return {
		// File / clipboard state
		selectedInfo,
		previewUrl,
		status,
		error,
		clipboardDebug,
		// Handlers
		handleFileInput,
		handlePaste,
		handleClear,
		// BlockNote editors
		baselineBlockNoteEditor,
		overrideBlockNoteEditor,
		baselineDiagnostics,
		overrideDiagnostics,
		baselineContainerRef,
		overrideContainerRef,
	};
}
