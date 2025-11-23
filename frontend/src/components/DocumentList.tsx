import type React from "react";
import { cn } from "../lib/utils";
import type { Document } from "../types/Document";
import { formatShortDate } from "../utils/dateUtils";
import { Button, Heading, Text } from "./ui";

interface DocumentListProps {
	documents: Document[];
	onDocumentClick: (path: string) => void;
	highlightedIndex?: number;
	onHighlightDocument?: (index: number) => void;
	selectedDocuments?: Set<string>;
	onToggleSelection?: (path?: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
	documents,
	onDocumentClick,
	highlightedIndex = 0,
	onHighlightDocument,
	selectedDocuments = new Set(),
	onToggleSelection,
}) => {
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
					<div key={doc.path} className="space-y-2 rounded border border-border p-4">
						<Heading as="h3" size="lg">{doc.title}</Heading>
						<div className="mt-2 flex gap-4 text-sm text-text-dim">
							<Text as="span" variant="dim" size="sm">{doc.projectAlias}</Text>
							<Text as="span" variant="dim" size="sm">{formatShortDate(doc.updated.toISOString())}</Text>
						</div>
						<div className="mt-2 flex gap-2">
							{doc.tags.map((tag) => (
								<span key={tag} className="rounded bg-surface px-2 py-1 text-xs text-text-dim">
									{tag}
								</span>
							))}
						</div>
					</div>
				))}
				<Text className="p-4 mt-4" size="sm" variant="dim">No documents yet. Create one to get started!</Text>
			</div>
		);
	}

	return (
		<div className="space-y-1" role="list">
			{documents.map((doc, index) => {
				const isHighlighted = index === highlightedIndex;
				const isSelected = selectedDocuments.has(doc.path);
				const borderClass = isHighlighted
					? "border-l-accent"
					: isSelected
						? "border-l-green"
						: "border-l-transparent";
				const itemClasses = cn(
					"group border-b border-border px-4 py-4 transition-colors border-l-4 hover:bg-surface/60",
					isHighlighted && "bg-surface/80",
					borderClass,
				);
				const indexClasses = cn(
					"text-sm font-mono shrink-0 pt-1",
					isSelected ? "text-green font-bold" : isHighlighted ? "text-accent" : "text-text-dim",
				);
				const toggleClasses = cn(
					"mt-1 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-semibold transition-colors",
					isSelected
						? "border-green text-green"
						: "border-border text-text-dim hover:text-text hover:border-text",
				);
				return (
					<div
						key={doc.path}
						className={itemClasses}
						role="listitem"
						aria-selected={isSelected}
						data-highlighted={isHighlighted}
						data-selected={isSelected}
					>
						<div className="flex items-start gap-3">
							<Button
								variant="ghost"
								size="sm"
								className={toggleClasses}
								data-selected={isSelected}
								aria-pressed={isSelected}
								aria-label={
									isSelected ? `Deselect ${doc.title ?? "document"}` : `Select ${doc.title ?? "document"}`
								}
								onClick={(event) => {
									event.stopPropagation();
									onToggleSelection?.(doc.path);
								}}
							>
								{isSelected ? "✓" : ""}
							</Button>
							<span className={indexClasses}>{index + 1}.</span>
							<div
								className="flex-1 cursor-pointer"
								onClick={() => {
									onHighlightDocument?.(index);
									onDocumentClick(doc.path);
								}}
							>
								<div className="flex items-center gap-2">
									<Heading as="h3" size="lg">{doc.title}</Heading>
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
										<span key={tag} className="px-2 py-1 text-xs rounded tag bg-bg-dark text-text-dim">
											{tag}
										</span>
									))}
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};
