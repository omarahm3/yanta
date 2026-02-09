import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useEffect, useRef } from "react";
import { Button, Heading, Text } from "../../components/ui";
import { cn } from "../../lib/utils";
import type { Document } from "../../types/Document";
import { formatShortDate } from "../../utils/dateUtils";

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
}

export const DocumentList: React.FC<DocumentListProps> = ({
	documents,
	onDocumentClick,
	highlightedIndex = 0,
	onHighlightDocument,
	selectedDocuments = new Set(),
	onToggleSelection,
	scrollRef,
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
		const placeholders: Document[] = [
			{
				path: "projects/work/doc-placeholder1.json",
				projectAlias: "work",
				title: "Sample Document 1",
				blocks: [],
				tags: ["sample", "placeholder"],
				created: new Date(),
				updated: new Date(),
			},
			{
				path: "projects/work/doc-placeholder2.json",
				projectAlias: "work",
				title: "Sample Document 2",
				blocks: [],
				tags: ["demo"],
				created: new Date(),
				updated: new Date(),
			},
		];

		return (
			<div className="opacity-50 space-y-2">
				{placeholders.map((doc) => (
					<div
						key={doc.path}
						className="space-y-2 rounded-lg border border-glass-border bg-glass-bg/10 p-4"
					>
						<Heading as="h3" size="lg">
							{doc.title}
						</Heading>
						<div className="mt-2 flex gap-4 text-sm text-text-dim">
							<Text as="span" variant="dim" size="sm">
								{doc.projectAlias}
							</Text>
							<Text as="span" variant="dim" size="sm">
								{formatShortDate(doc.updated.toISOString())}
							</Text>
						</div>
						<div className="mt-2 flex gap-2">
							{doc.tags.map((tag) => (
								<span key={tag} className="rounded bg-glass-bg/20 px-2 py-1 text-xs text-text-dim">
									{tag}
								</span>
							))}
						</div>
					</div>
				))}
				<Text className="p-4 mt-4" size="sm" variant="dim">
					No documents yet. Create one to get started!
				</Text>
			</div>
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
	}) => {
		const borderStyle = isHighlighted || isSelected ? STYLE_BORDER_ACCENT : STYLE_EMPTY;
		const backgroundStyle = isHighlighted ? STYLE_BG_HIGHLIGHTED : STYLE_EMPTY;
		const itemClasses = cn(
			"group border-b border-glass-border/50 px-4 py-4 transition-colors border-l-4 border-l-transparent hover:bg-glass-bg/15",
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

		return (
			<div
				className={itemClasses}
				style={{ ...borderStyle, ...backgroundStyle }}
				role="listitem"
				aria-selected={isSelected}
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
								<span className="ml-auto rounded border border-accent/60 bg-accent/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
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
		);
	},
);
