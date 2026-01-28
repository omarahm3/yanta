import React from "react";
import { cn } from "../../lib/utils";

export interface KeyDisplayProps {
	keys: string[];
	className?: string;
}

export const KeyDisplay: React.FC<KeyDisplayProps> = ({ keys, className }) => {
	return (
		<div className={cn("flex items-center gap-1", className)}>
			{keys.map((key, index) => (
				<React.Fragment key={key}>
					{index > 0 && <span className="text-text-dim">+</span>}
					<kbd className="bg-bg border border-border rounded px-1.5 py-0.5 text-xs font-mono text-cyan">
						{key}
					</kbd>
				</React.Fragment>
			))}
		</div>
	);
};
