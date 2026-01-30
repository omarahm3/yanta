import type React from "react";
import { cn } from "../../lib/utils";

export interface JournalEntryData {
	id: string;
	content: string;
	tags: string[];
	created: string;
}

export interface JournalEntryProps {
	entry: JournalEntryData;
	onDelete: (id: string) => void;
	onEdit: (entry: JournalEntryData) => void;
	onSelect?: (id: string, selected: boolean) => void;
	isSelected?: boolean;
	showCheckbox?: boolean;
	className?: string;
}

/**
 * Single journal entry display component
 * Based on PRD Section 7.9 - Journal Entry Operations
 */
export const JournalEntry: React.FC<JournalEntryProps> = ({
	entry,
	onDelete,
	onEdit,
	onSelect,
	isSelected = false,
	showCheckbox = false,
	className,
}) => {
	const formattedTime = formatTime(entry.created);

	const handleContentClick = () => {
		onEdit(entry);
	};

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete(entry.id);
	};

	const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.stopPropagation();
		onSelect?.(entry.id, e.target.checked);
	};

	return (
		<div
			data-testid="journal-entry"
			className={cn(
				"group relative p-3 bg-surface border rounded-lg transition-colors",
				isSelected ? "border-[#61AFEF]" : "border-border hover:border-accent",
				className
			)}
		>
			<div className="flex items-start gap-3">
				{/* Checkbox for multi-select */}
				{showCheckbox && (
					<input
						type="checkbox"
						checked={isSelected}
						onChange={handleCheckboxChange}
						className="mt-1 rounded border-border"
					/>
				)}

				{/* Content */}
				<div className="flex-1 min-w-0">
					{/* Text content - clickable for edit */}
					<div
						className="text-sm text-text-primary cursor-pointer hover:text-accent"
						onClick={handleContentClick}
					>
						{entry.content}
					</div>

					{/* Tags and time */}
					<div className="flex items-center gap-2 mt-2 text-xs">
						{/* Tags */}
						{entry.tags.length > 0 && (
							<div className="flex gap-1.5">
								{entry.tags.map((tag) => (
									<span key={tag} className="text-[#98C379]">
										#{tag}
									</span>
								))}
							</div>
						)}

						{/* Separator */}
						{entry.tags.length > 0 && (
							<span className="text-text-secondary">·</span>
						)}

						{/* Time */}
						<span className="text-text-secondary">{formattedTime}</span>
					</div>
				</div>

				{/* Delete button - visible on hover */}
				<button
					type="button"
					onClick={handleDeleteClick}
					className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-[#E06C75] transition-opacity"
					aria-label="Delete entry"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M3 6h18" />
						<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
					</svg>
				</button>
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
