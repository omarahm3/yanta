import type React from "react";
import { cn } from "../../lib/utils";

export interface TagChipsProps {
	tags: string[];
	onRemove: (tag: string) => void;
	className?: string;
}

/**
 * Displays extracted tags as removable chips
 * Based on PRD Section 3.6 Tag Chips specification
 */
export const TagChips: React.FC<TagChipsProps> = ({ tags, onRemove, className }) => {
	if (tags.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			{tags.map((tag) => (
				<span
					key={tag}
					data-testid="tag-chip"
					className="tag-chip inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#2D3F54] text-[#98C379] font-medium"
				>
					<span className="text-[#98C379]/60">#</span>
					{tag}
					<button
						type="button"
						onClick={() => onRemove(tag)}
						className="ml-1 text-[#8B9CAF] hover:text-[#E8E8E8] transition-colors"
						aria-label={`Remove ${tag}`}
					>
						×
					</button>
				</span>
			))}
		</div>
	);
};
