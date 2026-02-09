import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useEffect, useRef, useState } from "react";
import { GranularErrorBoundary } from "@/app";
import { Layout } from "../components/Layout";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useHotkeys } from "../hooks";
import { cn } from "../lib/utils";
import type { NavigationState } from "../types";
import { DatePicker } from "./DatePicker";
import { JournalEntry } from "./JournalEntry";
import { useJournalController } from "./useJournalController";

const JOURNAL_ROW_ESTIMATE = 72;
const JOURNAL_ROW_GAP = 4;

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
const JournalComponent: React.FC<JournalProps> = ({
	onNavigate,
	className,
	onRegisterToggleSidebar,
	initialDate,
}) => {
	const controller = useJournalController({ onNavigate, initialDate });
	const listRef = useRef<HTMLDivElement>(null);
	const entryListScrollRef = useRef<HTMLDivElement>(null);
	const [entryListKey, setEntryListKey] = useState(0);

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

	const entryVirtualizer = useVirtualizer({
		count: entries.length,
		getScrollElement: () => entryListScrollRef.current,
		estimateSize: () => JOURNAL_ROW_ESTIMATE,
		gap: JOURNAL_ROW_GAP,
		getItemKey: (index) => entries[index]?.id ?? index,
		enabled: entries.length > 0,
	});
	const entryVirtualItems = entryVirtualizer.getVirtualItems();
	// Use virtual list when we have items and the virtualizer returned some; otherwise full list (e.g. scroll not ready)
	const useVirtualList = entries.length > 0 && entryVirtualItems.length > 0;

	useEffect(() => {
		if (entryListScrollRef.current && entries.length > 0 && highlightedIndex >= 0) {
			entryVirtualizer.scrollToIndex(highlightedIndex, { align: "auto" });
		}
	}, [highlightedIndex, entries.length, entryVirtualizer]);

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
					<div ref={entryListScrollRef} className="flex-1 overflow-y-auto">
						<GranularErrorBoundary
							key={entryListKey}
							message="Something went wrong in the journal entry list."
							onRetry={() => setEntryListKey((k) => k + 1)}
						>
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

							{!isLoading &&
								!isEmpty &&
								entries.length > 0 &&
								(useVirtualList ? (
									<div
										ref={listRef}
										role="list"
										style={{
											height: entryVirtualizer.getTotalSize(),
											position: "relative",
										}}
									>
										{entryVirtualItems.map((virtualRow) => {
											const entry = entries[virtualRow.index];
											if (!entry) return null;
											const index = virtualRow.index;
											return (
												<div
													key={virtualRow.key}
													data-index={virtualRow.index}
													ref={entryVirtualizer.measureElement}
													style={{
														position: "absolute",
														top: 0,
														left: 0,
														width: "100%",
														transform: `translateY(${virtualRow.start}px)`,
													}}
												>
													<JournalEntry
														entry={entry}
														index={index}
														onEntryClick={handleEntryClick}
														onToggleSelection={toggleSelection}
														isHighlighted={index === highlightedIndex}
														isSelected={selectedIds.has(entry.id)}
													/>
												</div>
											);
										})}
									</div>
								) : (
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
								))}
						</GranularErrorBoundary>
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

export const Journal = React.memo(JournalComponent);
