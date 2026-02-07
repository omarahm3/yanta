import { Window } from "@wailsio/runtime";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListActive } from "../../bindings/yanta/internal/project/service";
import { QUICK_CAPTURE_SHORTCUTS } from "../config";
import { useUserProgressContext } from "../contexts/UserProgressContext";
import { useHotkeys } from "../hooks";
import type { HotkeyConfig } from "../types/hotkeys";
import type { ProjectOption } from "./ProjectPicker";
import { QuickEditor } from "./QuickEditor";
import { TagChips } from "./TagChips";
import { useQuickCapture } from "./useQuickCapture";
import { BackendLogger } from "../utils/backendLogger";

/**
 * Quick Capture Window
 * Based on PRD Section 3 - Look & Feel
 */
export const QuickCapture: React.FC = () => {
	const [projects, setProjects] = useState<ProjectOption[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showEscapeHint, setShowEscapeHint] = useState(false);

	const { incrementJournalEntriesCreated } = useUserProgressContext();
	const { content, setContent, tags, error, save, removeTag, clear } = useQuickCapture({
		onEntrySaved: incrementJournalEntriesCreated,
	});

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
				BackendLogger.error("Failed to load projects:", err);
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
				...QUICK_CAPTURE_SHORTCUTS.save,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					void handleSave(false);
				},
				allowInInput: true,
				capture: true,
			},
			{
				...QUICK_CAPTURE_SHORTCUTS.saveAndStay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					void handleSave(true);
				},
				allowInInput: true,
				capture: true,
			},
			{
				...QUICK_CAPTURE_SHORTCUTS.cancel,
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
			<div
				className="h-full flex items-center justify-center bg-bg-dark text-text-dim font-sans text-sm rounded-xl overflow-hidden border border-glass-border"
				style={{
					backgroundImage:
						"radial-gradient(circle at 20% 50%, rgba(88, 166, 255, 0.06), transparent 50%), radial-gradient(circle at 80% 30%, rgba(163, 113, 247, 0.06), transparent 50%)",
				}}
			>
				<div className="bg-glass-bg/60 backdrop-blur-xl inset-0 absolute" />
				<span className="relative text-text-dim">Loading...</span>
			</div>
		);
	}

	return (
		<div
			className="flex flex-col h-full bg-bg-dark select-none w-full font-sans text-sm text-text rounded-xl overflow-hidden border border-glass-border"
			style={
				{
					"--wails-draggable": "drag",
					backgroundImage:
						"radial-gradient(circle at 20% 50%, rgba(88, 166, 255, 0.06), transparent 50%), radial-gradient(circle at 80% 30%, rgba(163, 113, 247, 0.06), transparent 50%)",
				} as React.CSSProperties
			}
		>
			{/* Glass overlay */}
			<div className="flex flex-col h-full bg-glass-bg/60 backdrop-blur-xl p-3">
				{/* Editor */}
				<div className="flex-1 min-h-0 mb-2">
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
					<div className="mb-1 px-1" style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}>
						<TagChips tags={tags} onRemove={removeTag} />
					</div>
				)}

				{/* Error message */}
				{error && <div className="mb-1 px-1 text-xs text-red">{error}</div>}

				{/* Escape hint */}
				{showEscapeHint && (
					<div className="mb-1 px-1 text-xs text-text-dim">Press Esc again to discard</div>
				)}

				{/* Footer with keyboard hints */}
				<div className="flex items-center justify-center gap-5 text-xs text-text-dim pt-2">
					<span className="inline-flex items-center gap-1.5">
						<kbd className="px-1.5 py-0.5 bg-glass-bg/40 backdrop-blur-sm border border-glass-border rounded text-[0.65rem] font-mono">
							Ctrl+⏎
						</kbd>
						<span>Save</span>
					</span>
					<span className="inline-flex items-center gap-1.5">
						<kbd className="px-1.5 py-0.5 bg-glass-bg/40 backdrop-blur-sm border border-glass-border rounded text-[0.65rem] font-mono">
							⇧⏎
						</kbd>
						<span>Save &amp; New</span>
					</span>
					<span className="inline-flex items-center gap-1.5">
						<kbd className="px-1.5 py-0.5 bg-glass-bg/40 backdrop-blur-sm border border-glass-border rounded text-[0.65rem] font-mono">
							⎋
						</kbd>
						<span>Cancel</span>
					</span>
				</div>
			</div>
		</div>
	);
};
