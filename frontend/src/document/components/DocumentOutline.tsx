import { List } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { EditorHandle } from "../../editor/types";
import { cn } from "../../shared/utils/cn";
import type { BlockNoteBlock } from "../../shared/types/Document";
import { extractHeadings, type HeadingItem } from "../utils/documentOutlineUtils";

interface DocumentOutlineProps {
	editor: EditorHandle | null;
	blocks: BlockNoteBlock[];
	isOpen: boolean;
	onClose: () => void;
}

export const DocumentOutline: React.FC<DocumentOutlineProps> = ({
	editor,
	blocks,
	isOpen,
	onClose,
}) => {
	const [headings, setHeadings] = useState<HeadingItem[]>([]);

	useEffect(() => {
		setHeadings(extractHeadings(blocks));
	}, [blocks]);

	const scrollToHeading = useCallback(
		(headingId: string) => {
			if (!editor) return;

			// Find the DOM element for the heading block
			const prosemirrorView = editor.prosemirrorView;
			if (!prosemirrorView) return;

			const blockElement = prosemirrorView.dom.querySelector(`[data-id="${headingId}"]`);
			if (blockElement) {
				blockElement.scrollIntoView({ behavior: "smooth", block: "start" });
				// Optionally focus the editor after scrolling
				setTimeout(() => {
					prosemirrorView.focus();
				}, 100);
			}
		},
		[editor],
	);

	if (!isOpen) return null;

	return (
		<div className="w-64 border-l border-glass-border bg-glass-bg/30 backdrop-blur-sm flex flex-col">
			<div className="flex items-center justify-between px-3 py-2 border-b border-glass-border/50">
				<div className="flex items-center gap-2 text-sm font-medium text-text">
					<List className="w-4 h-4" aria-hidden="true" />
					Outline
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-text-dim hover:text-text-bright transition-colors text-xs"
					aria-label="Close outline"
				>
					×
				</button>
			</div>
			<div className="flex-1 overflow-y-auto px-2 py-2">
				{headings.length === 0 ? (
					<div className="text-xs text-text-dim px-2 py-4 text-center">
						No headings found. Add H1-H3 headings to see the outline.
					</div>
				) : (
					<nav aria-label="Document outline">
						<ul className="space-y-1">
							{headings.map((heading) => (
								<li key={heading.id}>
									<button
										type="button"
										onClick={() => scrollToHeading(heading.id)}
										className={cn(
											"w-full text-left px-2 py-1 rounded text-sm transition-colors hover:bg-glass-bg/50",
											heading.level === 1 && "font-medium text-text",
											heading.level === 2 && "pl-4 text-text-dim",
											heading.level === 3 && "pl-6 text-text-dim text-xs",
										)}
										title={heading.text}
									>
										{heading.text || "(empty)"}
									</button>
								</li>
							))}
						</ul>
					</nav>
				)}
			</div>
		</div>
	);
};
