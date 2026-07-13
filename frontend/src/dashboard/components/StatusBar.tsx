import { Archive, ArchiveRestore, ChevronsUpDown, FolderInput, Trash2 } from "lucide-react";
import type React from "react";
import { useProjectSwitcherStore } from "../../project-switcher";
import { Button } from "../../shared/ui/Button";
import { StatusBarItem } from "../../shared/ui/StatusBarItem";
import type { DocumentSortField, SortDirection } from "../hooks/useDocumentSort";

interface StatusBarProps {
	totalEntries: number;
	currentContext: string;
	showArchived?: boolean;
	selectedCount?: number;
	onClearSelection?: () => void;
	onExportSelectedMarkdown?: () => void;
	onExportSelectedPDF?: () => void;
	onArchiveSelected?: () => void;
	onRestoreSelected?: () => void;
	onMoveSelected?: () => void;
	onDeleteSelected?: () => void;
	sortField?: DocumentSortField;
	sortDirection?: SortDirection;
	onSortChange?: (field: DocumentSortField) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
	totalEntries,
	currentContext,
	showArchived,
	selectedCount = 0,
	onClearSelection,
	onExportSelectedMarkdown,
	onExportSelectedPDF,
	onArchiveSelected,
	onRestoreSelected,
	onMoveSelected,
	onDeleteSelected,
	sortField = "updated",
	sortDirection = "desc",
	onSortChange,
}) => {
	const openProjectSwitcher = useProjectSwitcherStore((s) => s.open);
	const hasSelection = selectedCount > 0;
	const selectionLabel =
		selectedCount === 1 ? "1 document selected" : `${selectedCount} documents selected`;
	const docTitle = `${totalEntries} ${totalEntries === 1 ? "document" : "documents"}${
		showArchived ? " (archived view)" : ""
	}`;

	return (
		<div className="flex w-full flex-wrap items-center gap-4 border-t border-border bg-surface px-4 py-2 text-xs font-sans">
			<div className="flex items-center gap-3">
				<StatusBarItem label="Docs" value={totalEntries} title={docTitle} primary />
				{showArchived && (
					<span
						className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent"
						title="Showing archived documents"
					>
						Archived
					</span>
				)}
			</div>
			{hasSelection && (
				<div className="flex flex-wrap items-center gap-2 text-text">
					<span className="font-medium">{selectionLabel}</span>
					{onClearSelection && (
						<Button
							variant="secondary"
							size="sm"
							onClick={onClearSelection}
							className="px-2 py-1 text-xs"
						>
							Clear Selection
						</Button>
					)}
					{onExportSelectedMarkdown && (
						<Button
							variant="secondary"
							size="sm"
							onClick={onExportSelectedMarkdown}
							className="px-2 py-1 text-xs"
						>
							Export MD
						</Button>
					)}
					{onExportSelectedPDF && (
						<Button
							variant="secondary"
							size="sm"
							onClick={onExportSelectedPDF}
							className="px-2 py-1 text-xs"
						>
							Export PDF
						</Button>
					)}
					{onArchiveSelected && !showArchived && (
						<Button
							variant="secondary"
							size="sm"
							onClick={onArchiveSelected}
							className="px-2 py-1 text-xs"
						>
							<Archive className="h-3 w-3 mr-1" aria-hidden="true" />
							Archive
						</Button>
					)}
					{onRestoreSelected && showArchived && (
						<Button
							variant="secondary"
							size="sm"
							onClick={onRestoreSelected}
							className="px-2 py-1 text-xs"
						>
							<ArchiveRestore className="h-3 w-3 mr-1" aria-hidden="true" />
							Restore
						</Button>
					)}
					{onMoveSelected && (
						<Button variant="secondary" size="sm" onClick={onMoveSelected} className="px-2 py-1 text-xs">
							<FolderInput className="h-3 w-3 mr-1" aria-hidden="true" />
							Move
						</Button>
					)}
					{onDeleteSelected && (
						<Button
							variant="destructive"
							size="sm"
							onClick={onDeleteSelected}
							className="px-2 py-1 text-xs"
						>
							<Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
							Delete
						</Button>
					)}
				</div>
			)}
			{onSortChange && (
				<div className="flex items-center gap-1">
					<span className="text-text-dim mr-1">Sort:</span>
					{(["updated", "created", "title"] as DocumentSortField[]).map((field) => (
						<button
							key={field}
							type="button"
							onClick={() => onSortChange(field)}
							className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
								sortField === field
									? "bg-accent/15 text-text-bright font-medium"
									: "text-text-dim hover:text-text hover:bg-accent/8"
							}`}
						>
							{field === "updated" ? "Updated" : field === "created" ? "Created" : "Title"}
							{sortField === field && (
								<span className="ml-0.5">{sortDirection === "asc" ? "\u2191" : "\u2193"}</span>
							)}
						</button>
					))}
				</div>
			)}
			<button
				type="button"
				onClick={openProjectSwitcher}
				aria-label="Switch project"
				title="Switch project (Ctrl+Shift+K)"
				className="ml-auto inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-accent/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				<StatusBarItem label="Project" value={currentContext} title={`Project: ${currentContext}`} />
				<ChevronsUpDown className="size-3 text-text-dim/70" aria-hidden="true" />
			</button>
		</div>
	);
};
