import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useEffect, useRef, useState } from "react";
import { GranularErrorBoundary, Layout } from "@/app";
import { useHotkeys } from "../hotkeys";
import type { NavigationState, PageName } from "../shared/types";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { StatusBarItem } from "../shared/ui/StatusBarItem";
import { cn } from "../shared/utils/cn";
import { DatePicker } from "./DatePicker";
import { JournalComposer } from "./JournalComposer";
import { JournalEntry } from "./JournalEntry";
import { useJournalController } from "./useJournalController";

const JOURNAL_ROW_ESTIMATE = 72;
const JOURNAL_ROW_GAP = 4;

export interface JournalProps {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
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
		projectAlias,
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
		updateEntry,
		addEntry,
		quickCaptureHint,
		sidebarSections,
		confirmDialog,
		setConfirmDialog,
		statusBar,
	} = controller;

	// In-page capture targets a single project; the aggregated "all" view has none.
	const canCapture = projectAlias !== "all";

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

					{/* In-page capture for the viewed day */}
					{canCapture && (
						<div className="px-4 pt-3 pb-2 border-b border-glass-border">
							<JournalComposer onAdd={addEntry} hotkeyHint={quickCaptureHint} />
						</div>
					)}

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
									<p className="mt-2 text-sm">
										{canCapture
											? "Add one above, or press your Quick Capture hotkey."
											: "Press your Quick Capture hotkey to add one."}
									</p>
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
											const isHighlighted = index === highlightedIndex;
											const isSelected = selectedIds.has(entry.id);
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
													role="listitem"
													aria-selected={isSelected}
													tabIndex={isHighlighted ? 0 : -1}
													onFocus={() => controller.setHighlightedIndex(index)}
												>
													<JournalEntry
														entry={entry}
														index={index}
														onEntryClick={handleEntryClick}
														onToggleSelection={toggleSelection}
														onUpdateEntry={updateEntry}
														isHighlighted={isHighlighted}
														isSelected={isSelected}
													/>
												</div>
											);
										})}
									</div>
								) : (
									<div ref={listRef} className="space-y-1" role="list">
										{entries.map((entry, index) => {
											const isHighlighted = index === highlightedIndex;
											const isSelected = selectedIds.has(entry.id);
											return (
												<div
													key={entry.id}
													role="listitem"
													aria-selected={isSelected}
													tabIndex={isHighlighted ? 0 : -1}
													onFocus={() => controller.setHighlightedIndex(index)}
												>
													<JournalEntry
														entry={entry}
														index={index}
														onEntryClick={handleEntryClick}
														onToggleSelection={toggleSelection}
														onUpdateEntry={updateEntry}
														isHighlighted={isHighlighted}
														isSelected={isSelected}
													/>
												</div>
											);
										})}
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
	const hasSelection = selectedCount > 0;
	const selectionLabel =
		selectedCount === 1 ? "1 entry selected" : `${selectedCount} entries selected`;
	const entriesTitle = `${totalEntries} ${totalEntries === 1 ? "entry" : "entries"}`;

	return (
		<div className="flex w-full flex-wrap items-center gap-4 border-t border-glass-border bg-glass-bg/80 backdrop-blur-md px-4 py-2 text-xs font-sans">
			<StatusBarItem label="Entries" value={totalEntries} title={entriesTitle} primary />
			{hasSelection && (
				<div className="flex flex-wrap items-center gap-2 text-text">
					<span className="font-medium">{selectionLabel}</span>
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
			<StatusBarItem
				label="Project"
				value={currentContext}
				title={`Project: ${currentContext}`}
				className="ml-auto"
			/>
		</div>
	);
};

export const Journal = React.memo(JournalComponent);
