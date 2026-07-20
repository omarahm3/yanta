import { Dialogs } from "@wailsio/runtime";
import { useCallback } from "react";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../bindings/yanta/internal/document/service";
import { ExportImageRequest, ExportRequest } from "../../../bindings/yanta/internal/export/models";
import { ExportCanvasImage, ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import type { CanvasHandle } from "../../editor/types";
import { useNotification } from "../../shared/hooks";
import type {
	CanvasExportFormat,
	CanvasExportTheme,
} from "../../shared/stores/documentCommand.store";

export interface UseDocumentExportsOptions {
	documentPath?: string;
	documentTitle: string;
	/** Live canvas handle, present only while a canvas is the active pane. */
	canvasHandleRef?: React.RefObject<CanvasHandle | null>;
}

// Derive a safe export filename base from a document title. Sanitizing to
// [a-z0-9_] can empty out entirely (blank or all-CJK/emoji titles), which would
// yield a dotfile like ".md" or a string of bare underscores — fall back to a
// sensible default and collapse underscore runs.
export function exportBaseName(title: string): string {
	const base = title
		.replace(/[^a-z0-9]/gi, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.toLowerCase();
	return base || "untitled";
}

// Encode arbitrary bytes as base64 for the backend ExportCanvasImage payload.
// Chunked to stay well under argument-count limits for large images.
function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export function useDocumentExports({
	documentPath,
	documentTitle,
	canvasHandleRef,
}: UseDocumentExportsOptions) {
	const { error } = useNotification();

	const handleExportToMarkdown = useCallback(async () => {
		if (!documentPath) {
			error("No document open");
			return;
		}
		try {
			const defaultFilename = `${exportBaseName(documentTitle)}.md`;
			const outputPath = await Dialogs.SaveFile({
				Title: "Export to Markdown",
				Filename: defaultFilename,
				Filters: [
					{
						DisplayName: "Markdown Files",
						Pattern: "*.md",
					},
				],
			});

			if (!outputPath) {
				return;
			}

			await ExportDocument(
				new ExportDocumentRequest({
					DocumentPath: documentPath,
					OutputPath: outputPath,
				}),
			);
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export Markdown");
		}
	}, [documentPath, error, documentTitle]);

	const handleExportToPDF = useCallback(async () => {
		if (!documentPath) {
			error("No document open");
			return;
		}
		try {
			const defaultFilename = `${exportBaseName(documentTitle)}.pdf`;
			const outputPath = await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: defaultFilename,
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			if (!outputPath) {
				return;
			}

			await ExportToPDF(
				new ExportRequest({
					DocumentPath: documentPath,
					OutputPath: outputPath,
				}),
			);
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export PDF");
		}
	}, [documentPath, error, documentTitle]);

	const handleExportCanvasImage = useCallback(
		async (format: CanvasExportFormat, theme?: CanvasExportTheme) => {
			const handle = canvasHandleRef?.current;
			if (!handle) {
				error("No canvas open");
				return;
			}
			try {
				// Suffix light/dark so exporting both themes doesn't silently overwrite.
				const themeSuffix = theme ? `-${theme}` : "";
				const themeLabel = theme === "dark" ? " (Dark)" : theme === "light" ? " (Light)" : "";
				const defaultFilename = `${exportBaseName(documentTitle)}${themeSuffix}.${format}`;
				const outputPath = await Dialogs.SaveFile({
					Title:
						format === "png" ? `Export Canvas to PNG${themeLabel}` : `Export Canvas to SVG${themeLabel}`,
					Filename: defaultFilename,
					Filters: [
						{
							DisplayName: format === "png" ? "PNG Images" : "SVG Images",
							Pattern: format === "png" ? "*.png" : "*.svg",
						},
					],
				});

				if (!outputPath) {
					return;
				}

				let data: string;
				if (format === "png") {
					const blob = await handle.toPNG({ theme });
					data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
				} else {
					const svg = await handle.toSVG({ theme });
					data = bytesToBase64(new TextEncoder().encode(svg));
				}

				await ExportCanvasImage(
					new ExportImageRequest({
						OutputPath: outputPath,
						Data: data,
					}),
				);
			} catch (err) {
				error(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}`);
			}
		},
		[canvasHandleRef, documentTitle, error],
	);

	return { handleExportToMarkdown, handleExportToPDF, handleExportCanvasImage };
}
