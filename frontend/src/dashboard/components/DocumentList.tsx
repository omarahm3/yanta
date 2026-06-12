import { useVirtualizer } from "@tanstack/react-virtual";
import { Archive, FilePlus, FolderPlus } from "lucide-react";
import React, { useEffect, useRef } from "react";
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

const DOCUMENT_ROW_ESTIMATE = 88;
const DOCUMENT_ROW_GAP = 4;

const STYLE_BORDER_ACCENT = {
	borderLeftColor: "var(--mode-accent)",
	borderLeftWidth: "2px",
} as const;
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
								showArchived={showArchived}
								style={{ "--i": Math.min(index, 20) } as React.CSSProperties}
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
						showArchived={showArchived}
						style={{ "--i": Math.min(index, 20) } as React.CSSProperties}
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
	showArchived?: boolean;
	style?: React.CSSProperties;
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
		showArchived = false,
		style,
	}) => {
		const borderStyle = isHighlighted || isSelected ? STYLE_BORDER_ACCENT : STYLE_EMPTY;
		const backgroundStyle = isHighlighted ? STYLE_BG_HIGHLIGHTED : STYLE_EMPTY;
		const itemClasses = cn(
			"group border-b border-glass-border/50 px-4 py-4 transition-colors border-l-4 border-l-transparent hover:bg-glass-bg/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark",
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
			!isSelected && "border-glass-border text-text-dim hover:text-text hover:border-text",
		);

		const handleToggleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
			event.stopPropagation();
			onToggleSelection?.(doc.path);
		};

		const handleItemClick: React.MouseEventHandler<HTMLDivElement> = () => {
			onHighlightDocument?.(index);
			onDocumentClick(doc.path);
		};

		const handleDragStart: React.DragEventHandler<HTMLDivElement> = (e) => {
			e.dataTransfer.setData("application/x-yanta-document-path", doc.path);
			e.dataTransfer.effectAllowed = "copyMove";
		};

		const handleOpen = () => {
			onHighlightDocument?.(index);
			onDocumentClick(doc.path);
		};

		const handleToggleSelect = () => onToggleSelection?.(doc.path);

		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						className={cn(itemClasses, "animate-stagger-fade-in")}
						style={{
							...style,
							...borderStyle,
							...backgroundStyle,
							animationDelay: style ? `calc(var(--i, 0) * 30ms)` : undefined,
						}}
						role="listitem"
						aria-selected={isSelected}
						tabIndex={isHighlighted ? 0 : -1}
						onFocus={() => onHighlightDocument?.(index)}
						data-highlighted={isHighlighted}
						data-selected={isSelected}
						draggable
						onDragStart={handleDragStart}
					>
						<div className="flex items-start gap-3">
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
							<div className="flex-1 cursor-pointer" onClick={handleItemClick}>
								<div className="flex items-center gap-2">
									<Heading as="h3" size="lg">
										{doc.title}
									</Heading>
									{doc.deletedAt && (
										<span className="ml-auto rounded border border-accent/60 bg-accent/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
											Archived
										</span>
									)}
								</div>
								<div className="flex gap-4 mt-2 text-sm document-meta text-text-dim">
									<span>{doc.projectAlias}</span>
									<span>{formatShortDate(doc.updated.toISOString())}</span>
								</div>
								<div className="flex gap-2 mt-2 document-tags">
									{doc.tags.map((tag) => (
										<span
											key={tag}
											className="px-2 py-1 text-xs rounded tag bg-glass-bg/20 border border-glass-border/30 text-text-dim"
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
					<ContextMenuItem onSelect={handleToggleSelect}>
						{isSelected ? "Deselect" : "Select"}
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
