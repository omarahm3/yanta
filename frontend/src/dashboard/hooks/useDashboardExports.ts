import { useCallback } from "react";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../bindings/yanta/internal/export";
import { ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import { OpenDirectoryDialog } from "../../../bindings/yanta/internal/system/service";
import type { Document } from "../../shared/types/Document";

export interface UseDashboardExportsOptions {
	selectedDocumentsRef: React.RefObject<Set<string> | null> | React.MutableRefObject<Set<string>>;
	documentsRef: React.RefObject<Document[] | null> | React.MutableRefObject<Document[]>;
	error: (message: string) => void;
}

export interface UseDashboardExportsResult {
	handleExportSelectedMarkdown: () => Promise<void>;
	handleExportSelectedPDF: () => Promise<void>;
}

export function useDashboardExports({
	selectedDocumentsRef,
	documentsRef,
	error,
}: UseDashboardExportsOptions): UseDashboardExportsResult {
	// Markdown/PDF are rendered from BlockNote blocks; a canvas doc has none, so
	// exporting one produces an empty file. Skip canvases here (and hide the
	// buttons when the selection has no text docs — see DashboardPage).
	const getExportablePaths = useCallback(() => {
		const selected = selectedDocumentsRef.current ?? new Set<string>();
		const docs = documentsRef.current ?? [];
		return docs
			.filter((doc) => selected.has(doc.path) && doc.kind !== "canvas")
			.map((doc) => doc.path);
	}, [selectedDocumentsRef, documentsRef]);

	const handleExportSelectedMarkdown = useCallback(async () => {
		const paths = getExportablePaths();
		if (paths.length === 0) {
			error("No text documents selected to export (canvas documents export as images).");
			return;
		}
		try {
			const outputDir = await OpenDirectoryDialog();
			if (!outputDir) {
				return;
			}
			for (const docPath of paths) {
				const documentName = docPath.split("/").pop()?.replace(".json", ".md") || "document.md";
				const outputPath = `${outputDir}/${documentName}`;
				const req = new ExportDocumentRequest({
					DocumentPath: docPath,
					OutputPath: outputPath,
				});
				await ExportDocument(req);
			}
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export");
		}
	}, [getExportablePaths, error]);

	const handleExportSelectedPDF = useCallback(async () => {
		const paths = getExportablePaths();
		if (paths.length === 0) {
			error("No text documents selected to export (canvas documents export as images).");
			return;
		}
		try {
			const outputDir = await OpenDirectoryDialog();
			if (!outputDir) {
				return;
			}
			for (const docPath of paths) {
				const documentName = docPath.split("/").pop()?.replace(".json", ".pdf") || "document.pdf";
				const outputPath = `${outputDir}/${documentName}`;
				const req = new ExportRequest({
					DocumentPath: docPath,
					OutputPath: outputPath,
				});
				await ExportToPDF(req);
			}
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export");
		}
	}, [getExportablePaths, error]);

	return {
		handleExportSelectedMarkdown,
		handleExportSelectedPDF,
	};
}
