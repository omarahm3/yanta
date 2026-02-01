import type React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui";

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
export const JournalEntry: React.FC<JournalEntryProps> = ({
	entry,
	index,
	onEntryClick,
	onToggleSelection,
	isHighlighted = false,
	isSelected = false,
	className,
}) => {
	const formattedTime = formatTime(entry.created);

	const borderClass = isHighlighted
		? "border-l-accent"
		: isSelected
			? "border-l-green"
			: "border-l-transparent";

	const itemClasses = cn(
		"group border-b border-border px-4 py-4 transition-colors border-l-4 hover:bg-surface/60",
		isHighlighted && "bg-surface/80",
		borderClass,
		className
	);

	const indexClasses = cn(
		"text-sm font-mono shrink-0 pt-1",
		isSelected ? "text-green font-bold" : isHighlighted ? "text-accent" : "text-text-dim"
	);

	const toggleClasses = cn(
		"mt-1 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-semibold transition-colors",
		isSelected
			? "border-green text-green"
			: "border-border text-text-dim hover:text-text hover:border-text"
	);

	return (
		<div
			data-testid="journal-entry"
			className={itemClasses}
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
				<span className={indexClasses}>{index + 1}.</span>

				{/* Content */}
				<div
					className="flex-1 cursor-pointer min-w-0"
					onClick={() => onEntryClick(entry.id)}
				>
					{/* Text content */}
					<div className="text-sm text-text-primary hover:text-accent">
						{entry.content}
					</div>

					{/* Project, Tags and time */}
					<div className="flex items-center gap-2 mt-2 text-xs text-text-dim">
						{/* Project badge (when viewing all projects) */}
						{entry.projectAlias && (
							<>
								<span className="text-[#61AFEF]">{entry.projectAlias}</span>
								<span>·</span>
							</>
						)}

						{/* Tags */}
						{entry.tags.length > 0 && (
							<>
								<div className="flex gap-1.5">
									{entry.tags.map((tag) => (
										<span key={tag} className="text-[#98C379]">
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
