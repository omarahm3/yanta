import { Pencil } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Button } from "../shared/ui";
import { cn } from "../shared/utils/cn";

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

export interface JournalEntryData {
	id: string;
	content: string;
	tags: string[];
	created: string;
	projectAlias?: string; // Present when viewing "All Projects"
}

export interface JournalEntryProps {
	entry: JournalEntryData;
	index: number;
	onEntryClick: (id: string) => void;
	onToggleSelection?: (id: string) => void;
	/** Persist an edited entry body. Enables the inline edit affordance. */
	onUpdateEntry?: (id: string, content: string, tags: string[]) => Promise<void>;
	isHighlighted?: boolean;
	isSelected?: boolean;
	className?: string;
}

/**
 * Single journal entry display component
 * Based on PRD Section 7.9 - Journal Entry Operations
 * Follows Dashboard DocumentList pattern for consistent UX
 */
const JournalEntryComponent: React.FC<JournalEntryProps> = ({
	entry,
	index,
	onEntryClick,
	onToggleSelection,
	onUpdateEntry,
	isHighlighted = false,
	isSelected = false,
	className,
}) => {
	const formattedTime = formatTime(entry.created);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(entry.content);
	const [isSaving, setIsSaving] = useState(false);

	const startEditing = useCallback(() => {
		setDraft(entry.content);
		setIsEditing(true);
	}, [entry.content]);

	const cancelEditing = useCallback(() => {
		setIsEditing(false);
		setDraft(entry.content);
	}, [entry.content]);

	const saveEditing = useCallback(async () => {
		const next = draft.trim();
		if (!onUpdateEntry || next === "" || next === entry.content) {
			setIsEditing(false);
			return;
		}
		setIsSaving(true);
		try {
			await onUpdateEntry(entry.id, next, entry.tags);
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	}, [draft, entry.content, entry.id, entry.tags, onUpdateEntry]);

	const borderStyle = isHighlighted || isSelected ? STYLE_BORDER_ACCENT : STYLE_EMPTY;
	const backgroundStyle = isHighlighted ? STYLE_BG_HIGHLIGHTED : STYLE_EMPTY;

	const itemClasses = cn(
		"group border-b border-glass-border/50 px-4 py-4 transition-colors border-l-4 border-l-transparent hover:bg-glass-bg/15",
		className,
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

	return (
		<div
			data-testid="journal-entry"
			className={itemClasses}
			style={{ ...borderStyle, ...backgroundStyle }}
			role="listitem"
			aria-selected={isSelected}
			data-highlighted={isHighlighted}
			data-selected={isSelected}
		>
			<div className="flex items-start gap-3">
				{/* Selection toggle */}
				<Button
					variant="ghost"
					size="sm"
					className={toggleClasses}
					style={toggleStyle}
					data-selected={isSelected}
					aria-pressed={isSelected}
					aria-label={isSelected ? `Deselect entry` : `Select entry`}
					onClick={(e) => {
						e.stopPropagation();
						onToggleSelection?.(entry.id);
					}}
				>
					{isSelected ? "✓" : ""}
				</Button>

				{/* Index number */}
				<span className={indexClasses} style={indexStyle}>
					{index + 1}.
				</span>

				{/* Content */}
				<div className="flex-1 min-w-0">
					{isEditing ? (
						<div className="flex flex-col gap-2">
							<textarea
								// biome-ignore lint/a11y/noAutofocus: focus the editor the moment edit mode opens
								autoFocus
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										e.preventDefault();
										e.stopPropagation();
										cancelEditing();
									} else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
										e.preventDefault();
										void saveEditing();
									}
								}}
								rows={Math.min(8, Math.max(2, draft.split("\n").length))}
								className="w-full resize-y rounded-md border border-border bg-bg-dark px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
								aria-label="Edit entry"
							/>
							<div className="flex items-center gap-2 text-xs">
								<Button size="sm" onClick={() => void saveEditing()} disabled={isSaving}>
									{isSaving ? "Saving…" : "Save"}
								</Button>
								<Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isSaving}>
									Cancel
								</Button>
								<span className="text-text-dim">⌘/Ctrl+Enter to save · Esc to cancel</span>
							</div>
						</div>
					) : (
						<div className="group/content flex items-start gap-2">
							{/* Text content */}
							<button
								type="button"
								className="flex-1 min-w-0 cursor-pointer text-left text-sm text-text-primary hover:text-accent whitespace-pre-wrap"
								onClick={() => onEntryClick(entry.id)}
							>
								{entry.content}
							</button>
							{onUpdateEntry && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										startEditing();
									}}
									aria-label="Edit entry"
									title="Edit entry"
									className="mt-0.5 shrink-0 rounded p-1 text-text-dim opacity-0 transition-opacity hover:bg-accent/10 hover:text-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent group-hover:opacity-100"
								>
									<Pencil className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
							)}
						</div>
					)}

					{/* Project, Tags and time */}
					<div className="flex items-center gap-2 mt-2 text-xs text-text-dim">
						{/* Project badge (when viewing all projects) */}
						{entry.projectAlias && (
							<>
								<span className="text-accent">{entry.projectAlias}</span>
								<span>·</span>
							</>
						)}

						{/* Tags */}
						{entry.tags.length > 0 && (
							<>
								<div className="flex gap-1.5">
									{entry.tags.map((tag) => (
										<span key={tag} className="text-green">
											#{tag}
										</span>
									))}
								</div>
								<span>·</span>
							</>
						)}

						{/* Time */}
						<span>{formattedTime}</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export const JournalEntry = React.memo(JournalEntryComponent);

/**
 * Format timestamp to display time
 */
function formatTime(isoString: string): string {
	try {
		const date = new Date(isoString);
		return date.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}
