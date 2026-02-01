import { Window } from "@wailsio/runtime";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListActive } from "../../../bindings/yanta/internal/project/service";
import { useHotkeys } from "../../hooks";
import type { HotkeyConfig } from "../../types/hotkeys";
import type { ProjectOption } from "./ProjectPicker";
import { QuickEditor } from "./QuickEditor";
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

	const { content, setContent, tags, error, save, removeTag, clear } = useQuickCapture();

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
		[save, handleClose],
	);

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{
				key: "ctrl+enter",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					void handleSave(false);
				},
				allowInInput: true,
				capture: true,
				description: "Save and close",
			},
			{
				key: "shift+enter",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					void handleSave(true);
				},
				allowInInput: true,
				capture: true,
				description: "Save and keep window open",
			},
			{
				key: "Escape",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					if (!content.trim()) {
						handleClose();
					} else if (showEscapeHint) {
						clear();
						handleClose();
					} else {
						setShowEscapeHint(true);
					}
				},
				allowInInput: true,
				capture: true,
				description: "Close or discard",
			},
		],
		[content, showEscapeHint, handleSave, handleClose, clear],
	);

	useHotkeys(hotkeys);

	// Clear "Press Esc again to discard" hint when user presses any key other than Escape
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (showEscapeHint && e.key !== "Escape") {
				setShowEscapeHint(false);
			}
		},
		[showEscapeHint],
	);

	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center bg-bg text-text-dim border border-accent/30">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-bg p-4 select-none w-full border border-accent/30">
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
			{error && <div className="mb-2 px-1 text-sm text-[#E06C75]">{error}</div>}

			{/* Escape hint */}
			{showEscapeHint && (
				<div className="mb-2 px-1 text-sm text-[#8B9CAF]">Press Esc again to discard</div>
			)}

			{/* Footer with keyboard hints */}
			<div className="flex items-center justify-center gap-6 text-xs text-text-dim pt-1">
				<span>
					<kbd className="px-1.5 py-0.5 bg-surface rounded">Ctrl+⏎</kbd> Save
				</span>
				<span>
					<kbd className="px-1.5 py-0.5 bg-surface rounded">⇧⏎</kbd> Save & New
				</span>
				<span>
					<kbd className="px-1.5 py-0.5 bg-surface rounded">⎋</kbd> Cancel
				</span>
			</div>
		</div>
	);
};
