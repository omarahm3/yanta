import type React from "react";
import { cn } from "../../lib/utils";

export interface FooterHint {
	key: string;
	label: string;
}

export interface FooterHintBarProps {
	hints: FooterHint[];
	className?: string;
}

/**
 * FooterHintBar displays context-aware keyboard shortcut hints at the bottom of the viewport.
 * It renders each hint as a pill showing the key (styled as keyboard badge) followed by the label.
 */
export const FooterHintBar: React.FC<FooterHintBarProps> = ({ hints, className }) => {
	if (hints.length === 0) {
		return null;
	}

	return (
		<div
			data-testid="footer-hint-bar"
			className={cn(
				"fixed bottom-0 left-0 right-0 h-8 flex items-center gap-4 px-4 text-xs bg-surface border-t border-border text-text-dim z-40",
				className,
			)}
		>
			{hints.map((hint) => (
				<div key={`${hint.key}-${hint.label}`} className="flex items-center gap-1">
					<kbd className="font-mono bg-bg px-1.5 py-0.5 rounded mr-1 text-text-dim border border-border">
						{hint.key}
					</kbd>
					<span>{hint.label}</span>
				</div>
			))}
		</div>
	);
};
