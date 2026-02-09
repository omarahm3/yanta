import React from "react";
import { Button } from "../components/ui";
import { cn } from "../lib/utils";

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
	isHighlighted = false,
	isSelected = false,
	className,
}) => {
	const formattedTime = formatTime(entry.created);

	// Use mode-accent colors for highlighting (via CSS variables)
	const borderStyle = isHighlighted
		? { borderLeftColor: "var(--mode-accent)", borderLeftWidth: "2px" }
		: isSelected
			? { borderLeftColor: "var(--mode-accent)", borderLeftWidth: "2px" }
			: {};
	const backgroundStyle = isHighlighted ? { backgroundColor: "var(--mode-accent-muted)" } : {};

	const itemClasses = cn(
		"group border-b border-glass-border/50 px-4 py-4 transition-colors border-l-4 border-l-transparent hover:bg-glass-bg/15",
		className,
	);

	// Use mode-accent for index text color when highlighted
	const indexStyle = isSelected
		? { color: "var(--mode-accent)", fontWeight: "bold" }
		: isHighlighted
			? { color: "var(--mode-accent)" }
			: {};
	const indexClasses = cn(
		"text-sm font-mono shrink-0 pt-1",
		!isSelected && !isHighlighted && "text-text-dim",
	);

	// Selection toggle button styling with mode-accent
	const toggleStyle = isSelected
		? { borderColor: "var(--mode-accent)", color: "var(--mode-accent)" }
		: {};
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
				<div className="flex-1 cursor-pointer min-w-0" onClick={() => onEntryClick(entry.id)}>
					{/* Text content */}
					<div className="text-sm text-text-primary hover:text-accent">{entry.content}</div>

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
