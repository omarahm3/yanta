import { Dialogs } from "@wailsio/runtime";
import { useCallback } from "react";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../bindings/yanta/internal/export/models";
import { ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import { useNotification } from "../../shared/hooks";

export interface UseDocumentExportsOptions {
	documentPath?: string;
	documentTitle: string;
}

export function useDocumentExports({ documentPath, documentTitle }: UseDocumentExportsOptions) {
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

	return { handleExportToMarkdown, handleExportToPDF };
}
