import { Archive, ArchiveRestore, FileDown, Save, Search } from "lucide-react";
import { ExportDocumentRequest } from "../../../../bindings/yanta/internal/document/models";
import { ExportDocument, SoftDelete } from "../../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../../bindings/yanta/internal/export";
import { ExportToPDF } from "../../../../bindings/yanta/internal/export/service";
import { OpenDirectoryDialog } from "../../../../bindings/yanta/internal/system/service";
import { useDocumentCommandStore } from "../../../shared/stores/documentCommand.store";
import type { CommandOption } from "../../../shared/ui";
import { getShortcutForCommand } from "../../../shared/utils/shortcuts";
import type { CommandRegistry, CommandRegistryContext } from "../types";

export function registerDocumentCommands(
	registry: CommandRegistry,
	ctx: CommandRegistryContext,
): void {
	const { handleClose, currentPage, getSelectedDocument, notification, onNavigate } = ctx;
	const commands: CommandOption[] = [];
	const hasDocument = currentPage === "document" && Boolean(getSelectedDocument()?.path);

	if (hasDocument) {
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

		commands.push({
			id: "find-in-document",
			icon: <Search className="text-lg" />,
			text: "Find in Document",
			shortcut: getShortcutForCommand("find-in-document"),
			group: "Document",
			keywords: ["search", "find", "lookup"],
			action: () => {
				handleClose();
				useDocumentCommandStore.getState().requestFind();
			},
		});

		commands.push({
			id: "archive-document",
			icon: <Archive className="text-lg" />,
			text: "Archive Document",
			hint: "Soft-delete current document",
			group: "Document",
			keywords: ["archive", "soft-delete", "remove"],
			action: async () => {
				handleClose();
				const currentDocument = getSelectedDocument();
				if (!currentDocument?.path) {
					notification.error("No document open");
					return;
				}
				try {
					await SoftDelete(currentDocument.path);
					notification.success("Document archived");
					// The editor is still showing the now-archived document; leave it
					// so the user can't keep editing a soft-deleted doc.
					onNavigate("dashboard");
				} catch (err) {
					notification.error(`Archive failed: ${err}`);
				}
			},
		});

		commands.push({
			id: "restore-document",
			icon: <ArchiveRestore className="text-lg" />,
			text: "Restore Document",
			hint: "Unarchive current document",
			group: "Document",
			keywords: ["restore", "unarchive"],
			// Route through the active controller's handler (not the backend binding
			// directly) so its local `hasRestored` state updates and the archived
			// banner / read-only editor clear without a reload.
			action: () => {
				handleClose();
				useDocumentCommandStore.getState().requestRestore();
			},
		});

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
	}

	registry.setCommands("document", commands);
}
