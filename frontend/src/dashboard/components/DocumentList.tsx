import { useVirtualizer } from "@tanstack/react-virtual";
import { Archive, FilePlus, FolderPlus, Split } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { useSidebarStateStore } from "../../shared/stores/sidebarState.store";
import type { Document } from "../../shared/types/Document";
import {
	Button,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	EmptyState,
	Heading,
} from "../../shared/ui";
import { cn } from "../../shared/utils/cn";
import { formatShortDate } from "../../shared/utils/date";

const DOCUMENT_ROW_ESTIMATE = 64;
const DOCUMENT_ROW_GAP = 4;

const STYLE_BG_HIGHLIGHTED = { backgroundColor: "var(--mode-accent-muted)" } as const;
const STYLE_INDEX_SELECTED = { color: "var(--mode-accent)", fontWeight: "bold" } as const;
const STYLE_INDEX_HIGHLIGHTED = { color: "var(--mode-accent)" } as const;
const STYLE_TOGGLE_SELECTED = {
	borderColor: "var(--mode-accent)",
	color: "var(--mode-accent)",
} as const;
const STYLE_EMPTY: React.CSSProperties = {};

interface DocumentListProps {
	documents: Document[];
	onDocumentClick: (path: string) => void;
	highlightedIndex?: number;
	onHighlightDocument?: (index: number) => void;
	selectedDocuments?: Set<string>;
	onToggleSelection?: (path?: string) => void;
	/** When provided, the list is virtualized (only visible items rendered). Pass the ref of the scroll container. */
	scrollRef?: React.RefObject<HTMLDivElement | null>;
	/** Optional: archive a single document (shown in context menu when not in archived view). */
	onArchiveDocument?: (path: string) => void;
	/** Optional: restore a single archived document (shown in context menu when in archived view). */
	onRestoreDocument?: (path: string) => void;
	/** Optional: open move dialog for a single document. */
	onMoveDocument?: (path: string) => void;
	/** Optional: open a document in a new split pane. */
	onOpenInSplit?: (path: string) => void;
	/** Whether the list is showing archived documents (affects context menu labels). */
	showArchived?: boolean;
	currentProjectAlias?: string | null;
	hasProjects?: boolean;
	onCreateDocument?: () => void;
	onShowProjects?: () => void;
	onShowActiveDocuments?: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
	documents,
	onDocumentClick,
	highlightedIndex = 0,
	onHighlightDocument,
	selectedDocuments = new Set(),
	onToggleSelection,
	scrollRef,
	onArchiveDocument,
	onRestoreDocument,
	onMoveDocument,
	onOpenInSplit,
	showArchived = false,
	currentProjectAlias,
	hasProjects = false,
	onCreateDocument,
	onShowProjects,
	onShowActiveDocuments,
}) => {
	const listRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: documents.length,
		getScrollElement: () => scrollRef?.current ?? null,
		estimateSize: () => DOCUMENT_ROW_ESTIMATE,
		gap: DOCUMENT_ROW_GAP,
		getItemKey: (index) => documents[index]?.path ?? index,
		enabled: !!scrollRef && documents.length > 0,
	});

	const virtualItems = virtualizer.getVirtualItems();

	useEffect(() => {
		if (scrollRef?.current && documents.length > 0 && highlightedIndex >= 0) {
			virtualizer.scrollToIndex(highlightedIndex, { align: "auto" });
		}
	}, [highlightedIndex, scrollRef, documents.length, virtualizer]);

	if (documents.length === 0) {
		const emptyState = showArchived
			? {
					icon: <Archive className="h-6 w-6" aria-hidden="true" />,
					title: "No archived documents yet",
					description: "Archive documents when you want them out of the way without losing them.",
					actionLabel: "Show active documents",
					onAction: onShowActiveDocuments,
				}
			: currentProjectAlias
				? {
						icon: <FilePlus className="h-6 w-6" aria-hidden="true" />,
						title: `No documents in @${currentProjectAlias} yet`,
						description: "Create the first document in this project to get writing.",
						actionLabel: "Create first document",
						onAction: onCreateDocument,
					}
				: hasProjects
					? {
							icon: <FolderPlus className="h-6 w-6" aria-hidden="true" />,
							title: "No project selected",
							description: "Select a project from the sidebar or projects page to view its documents.",
							actionLabel: "Open projects",
							onAction: onShowProjects,
						}
					: {
							icon: <FolderPlus className="h-6 w-6" aria-hidden="true" />,
							title: "No projects yet",
							description: "Create a project first, then you can start adding documents to it.",
							actionLabel: "Open projects",
							onAction: onShowProjects,
						};
		return (
			<EmptyState
				icon={emptyState.icon}
				title={emptyState.title}
				description={emptyState.description}
				actionLabel={emptyState.actionLabel}
				onAction={emptyState.onAction}
			/>
		);
	}

	// Virtualize when scroll ref is provided; fallback to full list when virtualizer returns no items (e.g. scroll not ready yet)
	if (scrollRef && documents.length > 0 && virtualItems.length > 0) {
		return (
			<div
				ref={listRef}
				role="list"
				style={{ height: virtualizer.getTotalSize(), position: "relative" }}
			>
				{virtualItems.map((virtualRow) => {
					const doc = documents[virtualRow.index];
					if (!doc) return null;
					const index = virtualRow.index;
					const isHighlighted = index === highlightedIndex;
					const isSelected = selectedDocuments.has(doc.path);
					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							<DocumentListItem
								doc={doc}
								index={index}
								isHighlighted={isHighlighted}
								isSelected={isSelected}
								onDocumentClick={onDocumentClick}
								onHighlightDocument={onHighlightDocument}
								onToggleSelection={onToggleSelection}
								onArchiveDocument={onArchiveDocument}
								onRestoreDocument={onRestoreDocument}
								onMoveDocument={onMoveDocument}
								onOpenInSplit={onOpenInSplit}
								showArchived={showArchived}
							/>
						</div>
					);
				})}
			</div>
		);
	}

	return (
		<div ref={listRef} className="space-y-1" role="list">
			{documents.map((doc, index) => {
				const isHighlighted = index === highlightedIndex;
				const isSelected = selectedDocuments.has(doc.path);
				return (
					<DocumentListItem
						key={doc.path}
						doc={doc}
						index={index}
						isHighlighted={isHighlighted}
						isSelected={isSelected}
						onDocumentClick={onDocumentClick}
						onHighlightDocument={onHighlightDocument}
						onToggleSelection={onToggleSelection}
						onArchiveDocument={onArchiveDocument}
						onRestoreDocument={onRestoreDocument}
						onMoveDocument={onMoveDocument}
						onOpenInSplit={onOpenInSplit}
						showArchived={showArchived}
					/>
				);
			})}
		</div>
	);
};

interface DocumentListItemProps {
	doc: Document;
	index: number;
	isHighlighted: boolean;
	isSelected: boolean;
	onDocumentClick: (path: string) => void;
	onHighlightDocument?: (index: number) => void;
	onToggleSelection?: (path?: string) => void;
	onArchiveDocument?: (path: string) => void;
	onRestoreDocument?: (path: string) => void;
	onMoveDocument?: (path: string) => void;
	onOpenInSplit?: (path: string) => void;
	showArchived?: boolean;
}

const DocumentListItem: React.FC<DocumentListItemProps> = React.memo(
	({
		doc,
		index,
		isHighlighted,
		isSelected,
		onDocumentClick,
		onHighlightDocument,
		onToggleSelection,
		onArchiveDocument,
		onRestoreDocument,
		onMoveDocument,
		onOpenInSplit,
		showArchived = false,
	}) => {
		const backgroundStyle = isHighlighted || isSelected ? STYLE_BG_HIGHLIGHTED : STYLE_EMPTY;
		const itemClasses = cn(
			"group border-b border-border/70 px-3 py-2.5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
		);
		const indexStyle = isSelected
			? STYLE_INDEX_SELECTED
			: isHighlighted
				? STYLE_INDEX_HIGHLIGHTED
				: STYLE_EMPTY;
		const indexClasses = cn(
			"text-sm font-mono shrink-0 pt-1",
			!isSelected && !isHighlighted && "text-text-dim",
		);
		const toggleStyle = isSelected ? STYLE_TOGGLE_SELECTED : STYLE_EMPTY;
		const toggleClasses = cn(
			"mt-1 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-semibold transition-colors",
			!isSelected && "border-border text-text-dim hover:text-text hover:border-text",
		);

		const handleToggleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
			event.stopPropagation();
			onToggleSelection?.(doc.path);
		};

		const handleItemClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
			onHighlightDocument?.(index);
			if (event.button === 1 && onOpenInSplit) {
				event.preventDefault();
				onOpenInSplit(doc.path);
			} else {
				onDocumentClick(doc.path);
			}
		};

		const handleDragStart: React.DragEventHandler<HTMLDivElement> = (e) => {
			e.dataTransfer.setData("application/x-yanta-document-path", doc.path);
			e.dataTransfer.effectAllowed = "copyMove";
		};

		const pinDocument = useSidebarStateStore((s) => s.pinDocument);
		const unpinDocument = useSidebarStateStore((s) => s.unpinDocument);
		const isPinned = useSidebarStateStore((s) => s.pinnedDocuments.some((d) => d.path === doc.path));

		const handleOpen = () => {
			onHighlightDocument?.(index);
			onDocumentClick(doc.path);
		};

		const handleItemClickKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				if ((event.metaKey || event.ctrlKey) && onOpenInSplit) {
					onOpenInSplit(doc.path);
				} else {
					handleOpen();
				}
			} else if (event.key === " ") {
				event.preventDefault();
				handleOpen();
			}
		};

		const handleToggleSelect = () => onToggleSelection?.(doc.path);

		const handleTogglePin = () => {
			if (isPinned) {
				unpinDocument(doc.path);
			} else {
				pinDocument({
					path: doc.path,
					title: doc.title,
					projectAlias: doc.projectAlias ?? "",
				});
			}
		};

		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						className={itemClasses}
						style={backgroundStyle}
						role="listitem"
						aria-selected={isSelected}
						tabIndex={isHighlighted ? 0 : -1}
						onFocus={() => onHighlightDocument?.(index)}
						data-highlighted={isHighlighted}
						data-selected={isSelected}
						draggable
						onDragStart={handleDragStart}
					>
						<div className="flex items-start gap-2.5">
							<Button
								variant="ghost"
								size="sm"
								className={toggleClasses}
								style={toggleStyle}
								data-selected={isSelected}
								aria-pressed={isSelected}
								aria-label={
									isSelected ? `Deselect ${doc.title ?? "document"}` : `Select ${doc.title ?? "document"}`
								}
								onClick={handleToggleClick}
							>
								{isSelected ? "✓" : ""}
							</Button>
							<span className={indexClasses} style={indexStyle}>
								{index + 1}.
							</span>
							<div
								className="flex-1 cursor-pointer"
								role="button"
								tabIndex={0}
								onClick={handleItemClick}
								onKeyDown={handleItemClickKeyDown}
							>
								<div className="flex items-center gap-2">
									<Heading as="h3" size="base">
										{doc.title}
									</Heading>
									{doc.deletedAt && (
										<span className="ml-auto rounded border border-border bg-bg-dark px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-text-dim">
											Archived
										</span>
									)}
								</div>
								<div className="flex gap-3 mt-1 text-xs document-meta text-text-dim">
									<span>{doc.projectAlias}</span>
									<span>{formatShortDate(doc.updated.toISOString())}</span>
								</div>
								<div className="flex gap-1.5 mt-1.5 document-tags">
									{doc.tags.map((tag) => (
										<span
											key={tag}
											className="px-2 py-1 text-xs rounded tag bg-surface border border-border text-text-dim"
										>
											{tag}
										</span>
									))}
								</div>
							</div>
						</div>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onSelect={handleOpen}>Open</ContextMenuItem>
					{onOpenInSplit && (
						<ContextMenuItem onSelect={() => onOpenInSplit(doc.path)}>
							<span className="flex items-center gap-2">
								<Split className="h-3.5 w-3.5" aria-hidden="true" />
								Open in split
							</span>
						</ContextMenuItem>
					)}
					<ContextMenuItem onSelect={handleToggleSelect}>
						{isSelected ? "Deselect" : "Select"}
					</ContextMenuItem>
					<ContextMenuItem onSelect={handleTogglePin}>
						{isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
					</ContextMenuItem>
					{onMoveDocument && (
						<ContextMenuItem onSelect={() => onMoveDocument(doc.path)}>Move to...</ContextMenuItem>
					)}
					{showArchived && onRestoreDocument && (
						<ContextMenuItem onSelect={() => onRestoreDocument(doc.path)}>Restore</ContextMenuItem>
					)}
					{!showArchived && onArchiveDocument && (
						<ContextMenuItem onSelect={() => onArchiveDocument(doc.path)}>Archive</ContextMenuItem>
					)}
				</ContextMenuContent>
			</ContextMenu>
		);
	},
);
