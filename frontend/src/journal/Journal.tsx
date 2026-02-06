import type React from "react";
import { useEffect, useRef } from "react";
import { Layout } from "../components/Layout";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useHotkeys } from "../hooks";
import { cn } from "../lib/utils";
import type { NavigationState } from "../types";
import { DatePicker } from "./DatePicker";
import { JournalEntry } from "./JournalEntry";
import { useJournalController } from "./useJournalController";

export interface JournalProps {
	onNavigate?: (page: string, state?: NavigationState) => void;
	className?: string;
	onRegisterToggleSidebar?: (handler: () => void) => void;
	initialDate?: string;
}

/**
 * Journal Browser UI
 * Based on PRD Section 7.9 - Journal Entry Operations
 * Follows Dashboard pattern for consistent UX
 */
export const Journal: React.FC<JournalProps> = ({
	onNavigate,
	className,
	onRegisterToggleSidebar,
	initialDate,
}) => {
	const controller = useJournalController({ onNavigate, initialDate });
	const listRef = useRef<HTMLDivElement>(null);

	useHotkeys(controller.hotkeys);

	const {
		entries,
		isLoading,
		error,
		isEmpty,
		date,
		datesWithEntries,
		highlightedIndex,
		selectedIds,
		setDate,
		handleEntryClick,
		toggleSelection,
		clearSelection,
		handleDeleteSelected,
		handlePromoteSelected,
		sidebarSections,
		confirmDialog,
		setConfirmDialog,
		statusBar,
	} = controller;

	useEffect(() => {
		if (listRef.current && highlightedIndex >= 0) {
			const items = listRef.current.querySelectorAll("[role='listitem']");
			items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
		}
	}, [highlightedIndex]);

	return (
		<>
			<Layout
				sidebarSections={sidebarSections}
				currentPage="journal"
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			>
				<div className={cn("flex flex-col h-full", className)}>
					{/* Date picker */}
					<div className="p-4 border-b border-glass-border">
						<DatePicker selectedDate={date} onDateChange={setDate} datesWithEntries={datesWithEntries} />
					</div>

					{/* Entry list */}
					<div className="flex-1 overflow-y-auto">
						{isLoading && (
							<div className="flex items-center justify-center py-8">
								<div className="text-text-dim">Loading...</div>
							</div>
						)}

						{error && <div className="text-center text-red py-8">{error}</div>}

						{isEmpty && !isLoading && (
							<div className="text-center text-text-dim py-8">
								<p>No entries for this day.</p>
								<p className="mt-2 text-sm">Press your quick capture hotkey to add one!</p>
							</div>
						)}

						{!isLoading && !isEmpty && (
							<div ref={listRef} className="space-y-1" role="list">
								{entries.map((entry, index) => (
									<JournalEntry
										key={entry.id}
										entry={entry}
										index={index}
										onEntryClick={handleEntryClick}
										onToggleSelection={toggleSelection}
										isHighlighted={index === highlightedIndex}
										isSelected={selectedIds.has(entry.id)}
									/>
								))}
							</div>
						)}
					</div>

					{/* Status bar */}
					<JournalStatusBar
						totalEntries={statusBar.totalEntries}
						currentContext={statusBar.currentContext}
						selectedCount={statusBar.selectedCount}
						onClearSelection={statusBar.selectedCount > 0 ? clearSelection : undefined}
						onPromoteSelected={statusBar.selectedCount > 0 ? handlePromoteSelected : undefined}
						onDeleteSelected={statusBar.selectedCount > 0 ? handleDeleteSelected : undefined}
					/>
				</div>
			</Layout>
			<ConfirmDialog
				isOpen={confirmDialog.isOpen}
				title={confirmDialog.title}
				message={confirmDialog.message}
				onConfirm={confirmDialog.onConfirm}
				onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
				danger={confirmDialog.danger}
			/>
		</>
	);
};

// Journal-specific status bar with promote and delete actions
interface JournalStatusBarProps {
	totalEntries: number;
	currentContext: string;
	selectedCount?: number;
	onClearSelection?: () => void;
	onPromoteSelected?: () => void;
	onDeleteSelected?: () => void;
}

const JournalStatusBar: React.FC<JournalStatusBarProps> = ({
	totalEntries,
	currentContext,
	selectedCount = 0,
	onClearSelection,
	onPromoteSelected,
	onDeleteSelected,
}) => {
	const entriesLabel = totalEntries === 1 ? "1 entry" : `${totalEntries} entries`;
	const hasSelection = selectedCount > 0;
	const selectionLabel =
		selectedCount === 1 ? "1 entry selected" : `${selectedCount} entries selected`;

	return (
		<div className="flex w-full flex-wrap items-center gap-3 border-t border-glass-border bg-glass-bg/80 backdrop-blur-md px-4 py-2 text-xs text-text-dim font-sans">
			<div className="flex items-center gap-3 whitespace-nowrap text-text">
				<span>{entriesLabel}</span>
			</div>
			{hasSelection && (
				<div className="flex flex-wrap items-center gap-2 text-text">
					<span className="font-semibold">{selectionLabel}</span>
					{onClearSelection && (
						<button
							type="button"
							onClick={onClearSelection}
							className="px-2 py-1 text-xs border border-border rounded hover:border-accent transition-colors"
						>
							Clear
						</button>
					)}
					{onPromoteSelected && (
						<button
							type="button"
							onClick={onPromoteSelected}
							className="px-2 py-1 text-xs border border-border rounded hover:border-accent transition-colors"
						>
							Promote to Doc
						</button>
					)}
					{onDeleteSelected && (
						<button
							type="button"
							onClick={onDeleteSelected}
							className="px-2 py-1 text-xs border border-red text-red rounded hover:bg-red/10 transition-colors"
						>
							Delete
						</button>
					)}
				</div>
			)}
			<div className="ml-auto flex items-center gap-1 whitespace-nowrap">
				<span>Context:</span>
				<span className="text-text">{currentContext}</span>
			</div>
		</div>
	);
};
