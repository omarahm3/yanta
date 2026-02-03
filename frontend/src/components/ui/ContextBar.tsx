import { BookOpen, FileText } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";

export type DataMode = "documents" | "journal" | "neutral";

export interface ContextBarProps {
	mode: DataMode;
	pageName: string;
	projectAlias?: string;
	className?: string;
}

/**
 * ContextBar displays a persistent location indicator showing:
 * - Current mode icon (FileText for documents, BookOpen for journal)
 * - Current page name
 * - Current project alias (prefixed with @)
 * - Keyboard hint showing "Ctrl+K" to open command palette
 */
export const ContextBar: React.FC<ContextBarProps> = ({
	mode,
	pageName,
	projectAlias,
	className,
}) => {
	const ModeIcon = mode === "journal" ? BookOpen : FileText;

	return (
		<div
			data-testid="context-bar"
			className={cn(
				"bg-bg border-b border-border px-5 py-1.5 flex items-center justify-between text-text-dim",
				className,
			)}
			style={{ fontSize: "12px" }}
		>
			<div className="flex items-center gap-3">
				{/* Mode icon */}
				<ModeIcon
					className="w-3.5 h-3.5"
					style={{ color: "var(--mode-accent)" }}
					aria-hidden="true"
					data-testid="context-bar-mode-icon"
				/>

				{/* Page name */}
				<span data-testid="context-bar-page-name" className="font-medium">
					{pageName}
				</span>

				{/* Project alias */}
				{projectAlias && (
					<span data-testid="context-bar-project-alias" className="text-text-dim">
						@{projectAlias}
					</span>
				)}
			</div>

			{/* Keyboard hint for command palette */}
			<div className="flex items-center gap-1.5">
				<kbd
					data-testid="context-bar-keyboard-hint"
					className="bg-surface px-1.5 py-0.5 rounded font-mono border border-border"
					style={{ fontSize: "11px" }}
				>
					Ctrl+K
				</kbd>
				<span className="opacity-50" style={{ fontSize: "11px" }}>
					command
				</span>
			</div>
		</div>
	);
};
