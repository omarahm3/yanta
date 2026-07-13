import { Check, Circle, Loader2, X } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type { SaveState } from "../../shared/hooks";

interface DocumentEditorActionsProps {
	isArchived?: boolean;
	saveState: SaveState;
	lastSaved: Date | null;
	hasUnsavedChanges: boolean;
	saveError: Error | null;
	wordCount?: number;
	charCount?: number;
	selectionCount?: number;
}

const formatTimeSince = (date: Date): string => {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
};

export const DocumentEditorActions: FC<DocumentEditorActionsProps> = ({
	isArchived = false,
	saveState,
	lastSaved,
	hasUnsavedChanges,
	saveError,
	wordCount = 0,
	charCount = 0,
	selectionCount,
}) => {
	const [, setTick] = useState(0);
	useEffect(() => {
		if (!lastSaved) return;
		const id = setInterval(() => setTick((n) => n + 1), 30_000);
		return () => clearInterval(id);
	}, [lastSaved]);

	const getStatusIndicator = () => {
		if (isArchived) {
			return {
				icon: Circle,
				text: "Read-only",
				color: "text-accent",
				iconClass: "",
			};
		}
		if (saveState === "saving") {
			return {
				icon: Loader2,
				text: "Saving",
				color: "text-accent",
				iconClass: "animate-spin",
			};
		}
		if (saveState === "error" && saveError) {
			return {
				icon: X,
				text: saveError.message,
				color: "text-red",
				iconClass: "",
			};
		}
		if (hasUnsavedChanges) {
			return {
				icon: Circle,
				text: "Unsaved",
				color: "text-yellow",
				iconClass: "fill-current",
			};
		}
		if (lastSaved) {
			return {
				icon: Check,
				text: formatTimeSince(lastSaved),
				color: "text-green",
				iconClass: "",
			};
		}
		return {
			icon: Circle,
			text: "Ready",
			color: "text-text-dim",
			iconClass: "",
		};
	};

	const status = getStatusIndicator();
	const IconComponent = status.icon;

	const countDisplay =
		selectionCount !== undefined && selectionCount > 0
			? `${selectionCount} selected`
			: `${wordCount} words · ${charCount} chars`;

	return (
		<div className="flex items-center justify-between px-4 py-2 border-t border-glass-border/50 bg-glass-bg/20 backdrop-blur-sm">
			<div className={`flex items-center gap-2 text-xs ${status.color}`}>
				<IconComponent className={status.iconClass} />
				<span>{status.text}</span>
			</div>
			<div className="text-xs text-text-dim tabular-nums">{countDisplay}</div>
		</div>
	);
};
