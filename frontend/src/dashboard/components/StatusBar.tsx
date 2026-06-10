import type React from "react";
import { Button } from "../../shared/ui/Button";
import { StatusBarItem } from "../../shared/ui/StatusBarItem";

interface StatusBarProps {
	totalEntries: number;
	currentContext: string;
	showArchived?: boolean;
	selectedCount?: number;
	onClearSelection?: () => void;
	onExportSelectedMarkdown?: () => void;
	onExportSelectedPDF?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
	totalEntries,
	currentContext,
	showArchived,
	selectedCount = 0,
	onClearSelection,
	onExportSelectedMarkdown,
	onExportSelectedPDF,
}) => {
	const hasSelection = selectedCount > 0;
	const selectionLabel =
		selectedCount === 1 ? "1 document selected" : `${selectedCount} documents selected`;
	const docTitle = `${totalEntries} ${totalEntries === 1 ? "document" : "documents"}${
		showArchived ? " (archived view)" : ""
	}`;

	return (
		<div className="flex w-full flex-wrap items-center gap-4 border-t border-glass-border bg-glass-bg/40 backdrop-blur-md px-4 py-2 text-xs font-sans">
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
				</div>
			)}
			<StatusBarItem
				label="Project"
				value={currentContext}
				title={`Project: ${currentContext}`}
				className="ml-auto"
			/>
		</div>
	);
};
