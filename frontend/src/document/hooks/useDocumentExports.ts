import { Dialogs } from "@wailsio/runtime";
import { useCallback } from "react";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../bindings/yanta/internal/document/service";
import { ExportImageRequest, ExportRequest } from "../../../bindings/yanta/internal/export/models";
import { ExportCanvasImage, ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import type { CanvasExportHandle } from "../../editor/types";
import { useNotification } from "../../shared/hooks";
import type { CanvasExportFormat } from "../../shared/stores/documentCommand.store";

export interface UseDocumentExportsOptions {
	documentPath?: string;
	documentTitle: string;
	/** Live canvas export handle, present only while a canvas is the active pane. */
	canvasExportRef?: React.RefObject<CanvasExportHandle | null>;
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
	canvasExportRef,
}: UseDocumentExportsOptions) {
	const { error } = useNotification();

	const handleExportToMarkdown = useCallback(async () => {
		if (!documentPath) {
			error("No document open");
			return;
		}
		try {
			const defaultFilename = `${documentTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
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
			const defaultFilename = `${documentTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
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
		async (format: CanvasExportFormat) => {
			const handle = canvasExportRef?.current;
			if (!handle) {
				error("No canvas open");
				return;
			}
			try {
				const defaultFilename = `${documentTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${format}`;
				const outputPath = await Dialogs.SaveFile({
					Title: format === "png" ? "Export Canvas to PNG" : "Export Canvas to SVG",
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
					const blob = await handle.toPNG();
					data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
				} else {
					const svg = await handle.toSVG();
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
		[canvasExportRef, documentTitle, error],
	);

	return { handleExportToMarkdown, handleExportToPDF, handleExportCanvasImage };
}
