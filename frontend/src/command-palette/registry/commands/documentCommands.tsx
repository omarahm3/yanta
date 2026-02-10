import { FileDown, Save } from "lucide-react";
import { ExportDocumentRequest } from "../../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../../bindings/yanta/internal/export";
import { ExportToPDF } from "../../../../bindings/yanta/internal/export/service";
import { OpenDirectoryDialog } from "../../../../bindings/yanta/internal/system/service";
import type { CommandOption } from "../../../components/ui";
import { useDocumentCommandStore } from "../../../shared/stores/documentCommand.store";
import { getShortcutForCommand } from "../../../utils/shortcuts";
import type { CommandRegistry, CommandRegistryContext } from "../types";

export function registerDocumentCommands(
	registry: CommandRegistry,
	ctx: CommandRegistryContext,
): void {
	const { handleClose, currentPage, getSelectedDocument, notification } = ctx;
	const commands: CommandOption[] = [];

	if (currentPage === "document") {
		commands.push({
			id: "save-document",
			icon: <Save className="text-lg" />,
			text: "Save Document",
			shortcut: getShortcutForCommand("save-document"),
			group: "Document",
			keywords: ["save", "persist"],
			action: () => {
				handleClose();
				useDocumentCommandStore.getState().requestSave();
			},
		});
	}

	commands.push({
		id: "export-document",
		icon: <FileDown className="text-lg" />,
		text: "Export Document",
		hint: "Export to markdown",
		group: "Document",
		action: async () => {
			handleClose();
			const currentDocument = getSelectedDocument();
			if (!currentDocument?.path) {
				notification.error("No document open");
				return;
			}
			try {
				const outputDir = await OpenDirectoryDialog();
				if (!outputDir) return;
				const documentName =
					currentDocument.path.split("/").pop()?.replace(".json", ".md") || "document.md";
				const outputPath = `${outputDir}/${documentName}`;
				await ExportDocument(
					new ExportDocumentRequest({
						DocumentPath: currentDocument.path,
						OutputPath: outputPath,
					}),
				);
			} catch (err) {
				notification.error(`Export failed: ${err}`);
			}
		},
	});

	commands.push({
		id: "export-document-pdf",
		icon: <FileDown className="text-lg" />,
		text: "Export Document to PDF",
		hint: "Export to PDF",
		group: "Document",
		action: async () => {
			handleClose();
			const currentDocument = getSelectedDocument();
			if (!currentDocument?.path) {
				notification.error("No document open");
				return;
			}
			try {
				const outputDir = await OpenDirectoryDialog();
				if (!outputDir) return;
				const documentName =
					currentDocument.path.split("/").pop()?.replace(".json", ".pdf") || "document.pdf";
				const outputPath = `${outputDir}/${documentName}`;
				await ExportToPDF(
					new ExportRequest({
						DocumentPath: currentDocument.path,
						OutputPath: outputPath,
					}),
				);
			} catch (err) {
				notification.error(`Export failed: ${err}`);
			}
		},
	});

	registry.setCommands("document", commands);
}
