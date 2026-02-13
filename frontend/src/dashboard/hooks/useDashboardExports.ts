import { useCallback } from "react";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../bindings/yanta/internal/export";
import { ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import { OpenDirectoryDialog } from "../../../bindings/yanta/internal/system/service";

export interface UseDashboardExportsOptions {
	selectedDocumentsRef: React.RefObject<Set<string> | null> | React.MutableRefObject<Set<string>>;
	error: (message: string) => void;
}

export interface UseDashboardExportsResult {
	handleExportSelectedMarkdown: () => Promise<void>;
	handleExportSelectedPDF: () => Promise<void>;
}

export function useDashboardExports({
	selectedDocumentsRef,
	error,
}: UseDashboardExportsOptions): UseDashboardExportsResult {
	const getSelectedPaths = useCallback(
		() => Array.from(selectedDocumentsRef.current ?? []),
		[selectedDocumentsRef],
	);

	const handleExportSelectedMarkdown = useCallback(async () => {
		const paths = getSelectedPaths();
		if (paths.length === 0) {
			error("No documents selected");
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
	}, [getSelectedPaths, error]);

	const handleExportSelectedPDF = useCallback(async () => {
		const paths = getSelectedPaths();
		if (paths.length === 0) {
			error("No documents selected");
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
	}, [getSelectedPaths, error]);

	return {
		handleExportSelectedMarkdown,
		handleExportSelectedPDF,
	};
}
