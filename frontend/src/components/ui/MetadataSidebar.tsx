import type React from "react";
import { cn } from "../../lib/utils";

export interface EntryMetadata {
	id: string;
	project: string;
	projectType?: "work" | "side" | "learn";
	type: "feature" | "bug" | "note";
	created: string;
	modified: string;
	tags: string[];
	stats: {
		words: number;
		characters: number;
		codeBlocks: number;
	};
}

export interface ActionButton {
	id: string;
	label: string;
	shortcut: string;
	onClick: () => void;
	variant?: "default" | "danger";
}

export interface MetadataSidebarProps {
	metadata: EntryMetadata;
	actions: ActionButton[];
	className?: string;
}

export const MetadataSidebar: React.FC<MetadataSidebarProps> = ({
	metadata,
	actions,
	className,
}) => {
	const getProjectColor = (type?: string) => {
		switch (type) {
			case "side":
				return "text-green";
			case "learn":
				return "text-orange";
			default:
				return "text-purple";
		}
	};

	const getTypeBadgeClasses = (type: string) => {
		const baseClasses =
			"inline-block px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider";

		switch (type) {
			case "feature":
				return cn(baseClasses, "bg-green/20 text-green");
			case "bug":
				return cn(baseClasses, "bg-red/20 text-red");
			default:
				return cn(baseClasses, "bg-text-dim/20 text-text-dim");
		}
	};

	return (
		<aside className={cn("w-60 bg-surface border-r border-border p-5 overflow-y-auto", className)}>
			{/* Entry ID */}
			<div className="text-xs text-text-dim mb-1">ENTRY #{metadata.id}</div>

			{/* Project */}
			<div className={cn("text-lg font-semibold mb-5", getProjectColor(metadata.projectType))}>
				{metadata.project}
			</div>

			{/* Type */}
			<div className="mb-6">
				<div className="text-xs uppercase tracking-wider text-text-dim mb-2">TYPE</div>
				<div>
					<span className={getTypeBadgeClasses(metadata.type)}>
						{metadata.type === "bug" ? "BUG FIX" : metadata.type.toUpperCase()}
					</span>
				</div>
			</div>

			{/* Created */}
			<div className="mb-6">
				<div className="text-xs uppercase tracking-wider text-text-dim mb-2">CREATED</div>
				<div className="text-sm text-text leading-relaxed">{metadata.created}</div>
			</div>

			{/* Modified */}
			<div className="mb-6">
				<div className="text-xs uppercase tracking-wider text-text-dim mb-2">MODIFIED</div>
				<div className="text-sm text-text leading-relaxed">{metadata.modified}</div>
			</div>

			{/* Tags */}
			<div className="mb-6">
				<div className="text-xs uppercase tracking-wider text-text-dim mb-2">TAGS</div>
				<div className="flex flex-wrap gap-1.5">
					{metadata.tags.map((tag) => (
						<span
							key={tag}
							className="px-2 py-0.5 bg-bg border border-border rounded text-xs text-cyan cursor-pointer transition-all hover:border-cyan hover:bg-cyan/10"
						>
							#{tag}
						</span>
					))}
				</div>
			</div>

			{/* Stats */}
			<div className="mb-6">
				<div className="text-xs uppercase tracking-wider text-text-dim mb-2">STATS</div>
				<div className="text-sm text-text leading-relaxed">
					Words: {metadata.stats.words}
					<br />
					Characters: {metadata.stats.characters}
					<br />
					Code blocks: {metadata.stats.codeBlocks}
				</div>
			</div>

			{/* Actions */}
			<div>
				<div className="text-xs uppercase tracking-wider text-text-dim mb-2">ACTIONS</div>
				<div className="flex flex-col gap-2">
					{actions.map((action) => (
						<button
							type="button"
							key={action.id}
							className={cn(
								"px-3 py-1.5 bg-bg border border-border rounded text-xs cursor-pointer transition-all text-left",
								action.variant === "danger"
									? "text-text-dim hover:border-red hover:text-red"
									: "text-text-dim hover:border-accent hover:text-text",
							)}
							onClick={action.onClick}
						>
							{action.shortcut} - {action.label}
						</button>
					))}
				</div>
			</div>
		</aside>
	);
};
