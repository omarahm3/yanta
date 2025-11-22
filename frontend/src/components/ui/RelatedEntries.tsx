import type React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export interface RelatedEntry {
	id: string;
	date: string;
	text: string;
	onClick?: () => void;
}

export interface RelatedEntriesProps {
	entries: RelatedEntry[];
	className?: string;
}

export const RelatedEntries: React.FC<RelatedEntriesProps> = ({ entries, className }) => {
	if (entries.length === 0) return null;

	return (
		<div className={cn("mt-12 pt-6 border-t border-border", className)}>
			<div className="text-xs uppercase tracking-wider text-text-dim mb-4">RELATED ENTRIES</div>
			<div className="flex flex-col gap-2">
				{entries.map((entry) => (
					<Button
						key={entry.id}
						variant="ghost"
						className="p-2.5 bg-surface border border-border rounded cursor-pointer transition-all text-left hover:border-accent hover:transform hover:translate-x-1 w-full justify-start flex-col items-start h-auto"
						onClick={entry.onClick}
					>
						<div className="text-xs text-text-dim mb-1">{entry.date}</div>
						<div className="text-sm leading-relaxed text-text">{entry.text}</div>
					</Button>
				))}
			</div>
		</div>
	);
};
