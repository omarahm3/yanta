import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TIMEOUTS } from "../../config";
import { useProjectContext } from "../../project";
import { moveDocumentToProject } from "../../shared/services/DocumentService";
import { useDialog } from "../../shared/stores/dialog.store";
import type { Project } from "../../shared/types/Project";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../shared/ui/dialog";
import { Input } from "../../shared/ui/Input";
import { Text } from "../../shared/ui/Text";
import { cn } from "../../shared/utils/cn";

export interface MoveDocumentDialogProps {
	isOpen: boolean;
	onClose: () => void;
	documentPaths: string[];
	currentProjectAlias: string;
	onMoved: () => void;
}

export const MoveDocumentDialog: React.FC<MoveDocumentDialogProps> = ({
	isOpen,
	onClose,
	documentPaths,
	currentProjectAlias,
	onMoved,
}) => {
	const { openDialog, closeDialog } = useDialog();
	const { projects } = useProjectContext();
	const [filterQuery, setFilterQuery] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const [isMoving, setIsMoving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isOpen) {
			openDialog();
			setFilterQuery("");
			setHighlightedIndex(0);
			setError(null);
			setTimeout(() => inputRef.current?.focus(), TIMEOUTS.focusRestoreMs);
		} else {
			closeDialog();
		}
	}, [isOpen, openDialog, closeDialog]);

	const filteredProjects = useMemo(
		() =>
			projects.filter(
				(p) =>
					p.alias !== currentProjectAlias &&
					(p.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
						p.alias.toLowerCase().includes(filterQuery.toLowerCase())),
			),
		[projects, currentProjectAlias, filterQuery],
	);

	useEffect(() => {
		setHighlightedIndex(0);
	}, [filterQuery]);

	useEffect(() => {
		if (listRef.current && highlightedIndex >= 0) {
			const items = listRef.current.querySelectorAll("[data-project-item]");
			items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
		}
	}, [highlightedIndex]);

	const handleMove = useCallback(
		async (targetProject: Project) => {
			if (isMoving) return;
			setIsMoving(true);
			setError(null);
			try {
				for (const docPath of documentPaths) {
					await moveDocumentToProject(docPath, targetProject.alias);
				}
				onMoved();
				onClose();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to move document");
			} finally {
				setIsMoving(false);
			}
		},
		[documentPaths, onMoved, onClose, isMoving],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
				e.preventDefault();
				setHighlightedIndex((prev) => Math.min(prev + 1, filteredProjects.length - 1));
			} else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
				e.preventDefault();
				setHighlightedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				const project = filteredProjects[highlightedIndex];
				if (project) {
					handleMove(project);
				}
			}
		},
		[filteredProjects, highlightedIndex, handleMove],
	);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	const docCount = documentPaths.length;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>{docCount === 1 ? "Move Document" : `Move ${docCount} Documents`}</DialogTitle>
				</DialogHeader>

				<div onKeyDown={handleKeyDown} className="space-y-3">
					<Input
						ref={inputRef}
						type="text"
						value={filterQuery}
						onChange={(e) => setFilterQuery(e.target.value)}
						placeholder="Search projects..."
						disabled={isMoving}
					/>

					{error && (
						<Text size="sm" className="text-red-400">
							{error}
						</Text>
					)}

					<div ref={listRef} className="flex flex-col max-h-64 overflow-y-auto gap-0.5">
						{filteredProjects.length === 0 ? (
							<Text size="sm" variant="dim" className="py-4 text-center">
								No other projects available
							</Text>
						) : (
							filteredProjects.map((project, index) => (
								<button
									key={project.id}
									type="button"
									data-project-item
									onClick={() => handleMove(project)}
									onMouseEnter={() => setHighlightedIndex(index)}
									disabled={isMoving}
									className={cn(
										"px-3 py-2 text-left rounded transition-colors",
										index === highlightedIndex
											? "bg-accent/10 text-text"
											: "text-text-dim hover:bg-glass-bg/20",
									)}
								>
									<div className="font-medium text-sm">{project.name}</div>
									<div className="text-xs opacity-60">{project.alias}</div>
								</button>
							))
						)}
					</div>

					<Text size="xs" variant="dim" className="text-center opacity-40">
						↑↓ / Ctrl+N/P navigate · Enter select · Esc close
					</Text>
				</div>
			</DialogContent>
		</Dialog>
	);
};
