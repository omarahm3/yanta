import type React from "react";
import { cn } from "../lib/utils";

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
					className="tag-chip inline-flex items-center gap-1 px-2 py-0.5 rounded bg-glass-bg/20 backdrop-blur-sm border border-glass-border/30 text-xs text-green font-medium"
				>
					<span className="text-green/60">#</span>
					{tag}
					<button
						type="button"
						onClick={() => onRemove(tag)}
						className="ml-1 text-text-dim hover:text-text-bright transition-colors"
						aria-label={`Remove ${tag}`}
					>
						×
					</button>
				</span>
			))}
		</div>
	);
};
