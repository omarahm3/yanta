import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Window } from "@wailsio/runtime";
import { ListActive } from "../../../bindings/yanta/internal/project/service";
import { cn } from "../../lib/utils";
import { QuickEditor } from "./QuickEditor";
import type { ProjectOption } from "./ProjectPicker";
import { TagChips } from "./TagChips";
import { useQuickCapture } from "./useQuickCapture";

/**
 * Quick Capture Window
 * Based on PRD Section 3 - Look & Feel
 */
export const QuickCapture: React.FC = () => {
	const [projects, setProjects] = useState<ProjectOption[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showEscapeHint, setShowEscapeHint] = useState(false);

	const {
		content,
		setContent,
		tags,
		error,
		isSaving,
		save,
		removeTag,
		clear,
	} = useQuickCapture();

	// Load projects on mount (for inline @ project list)
	useEffect(() => {
		const loadProjects = async () => {
			try {
				const result = await ListActive();
				const mapped = result
					.filter((p): p is NonNullable<typeof p> => p !== null)
					.map((p) => ({
						id: p.id,
						alias: (p.alias ?? "").replace(/^@/, ""),
						name: p.name,
					}));
				setProjects(mapped);
			} catch (err) {
				console.error("Failed to load projects:", err);
			} finally {
				setIsLoading(false);
			}
		};

		loadProjects();
	}, []);

	const handleClose = useCallback(() => {
		try {
			Window.Close();
		} catch {
			// Window.Close may not be available in tests
		}
	}, []);

	const handleSave = useCallback(
		async (keepOpen: boolean = false) => {
			const success = await save();
			if (success && !keepOpen) {
				handleClose();
			}
		},
		[save, handleClose]
	);

	const handleKeyDown = useCallback(
		async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			// Enter - Save and close
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				await handleSave(false);
				return;
			}

			// Shift+Enter - Save and keep window open for another note
			if (e.key === "Enter" && e.shiftKey) {
				e.preventDefault();
				await handleSave(true);
				return;
			}

			// Escape - Close or show hint
			if (e.key === "Escape") {
				e.preventDefault();

				if (!content.trim()) {
					// Empty - close immediately
					handleClose();
				} else if (showEscapeHint) {
					// Second Escape - discard and close
					clear();
					handleClose();
				} else {
					// First Escape with text - show hint
					setShowEscapeHint(true);
				}
				return;
			}

			// Reset escape hint on any other key
			if (showEscapeHint) {
				setShowEscapeHint(false);
			}
		},
		[content, showEscapeHint, handleSave, handleClose, clear]
	);

	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center bg-[#1B2636] text-[#5C6B7A]">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-[#1B2636] p-4 select-none w-full">
			<div className="flex-1 min-h-0 mb-3">
				<QuickEditor
					value={content}
					onChange={setContent}
					onKeyDown={handleKeyDown}
					projects={projects}
					autoFocus
					maxLength={10000}
					className="h-full"
				/>
			</div>

			{/* Tags */}
			{tags.length > 0 && (
				<div className="mb-2 px-1">
					<TagChips tags={tags} onRemove={removeTag} />
				</div>
			)}

			{/* Error message */}
			{error && (
				<div className="mb-2 px-1 text-sm text-[#E06C75]">{error}</div>
			)}

			{/* Escape hint */}
			{showEscapeHint && (
				<div className="mb-2 px-1 text-sm text-[#8B9CAF]">
					Press Esc again to discard
				</div>
			)}

			{/* Footer with keyboard hints */}
			<div className="flex items-center justify-center gap-6 text-xs text-[#5C6B7A] pt-1">
				<span>
					<kbd className="px-1.5 py-0.5 bg-[#2D3F54] rounded">⏎</kbd> Save
				</span>
				<span>
					<kbd className="px-1.5 py-0.5 bg-[#2D3F54] rounded">⇧⏎</kbd> Save & New
				</span>
				<span>
					<kbd className="px-1.5 py-0.5 bg-[#2D3F54] rounded">⎋</kbd> Cancel
				</span>
			</div>
		</div>
	);
};
