import { Events, Window } from "@wailsio/runtime";
import { PenLine } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QUICK_CAPTURE_SHORTCUTS } from "@/config/public";
import { DeleteEntry } from "../../bindings/yanta/internal/journal/wailsservice";
import { ListActive } from "../../bindings/yanta/internal/project/service";
import { ShowWindow } from "../../bindings/yanta/internal/system/service";
import { useHotkeys } from "../hotkeys";
import { useUserProgressContext } from "../onboarding";
import { useNotification } from "../shared/hooks";
import type { HotkeyConfig } from "../shared/types/hotkeys";
import { Button, Kbd } from "../shared/ui";
import { BackendLogger } from "../shared/utils/backendLogger";
import type { ProjectOption } from "./ProjectPicker";
import { QuickEditor } from "./QuickEditor";
import { TagChips } from "./TagChips";
import { type SavedEntryInfo, useQuickCapture } from "./useQuickCapture";

/**
 * Quick Capture Window
 * Based on PRD Section 3 - Look & Feel
 */

// Cross-window event: ask the main window to open the journal for a saved
// entry. Emitted from this (separate) Quick Capture window; a listener in the
// main window routes it. Kept as a plain string to match existing event names.
const NAVIGATE_JOURNAL_EVENT = "yanta/navigate/journal";

// After a "Save & close", keep the window open briefly so the success bar's
// Open/Undo actions are usable, then auto-close. The success bar lives for this
// whole window (not a racing toast), so the actions stay clickable throughout.
const SAVE_CLOSE_DELAY_MS = 4000;
const FLASH_DURATION_MS = 2000;

export const QuickCapture: React.FC = () => {
	const [projects, setProjects] = useState<ProjectOption[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showEscapeHint, setShowEscapeHint] = useState(false);
	const isAutocompleteOpenRef = useRef(false);

	const { incrementJournalEntriesCreated } = useUserProgressContext();
	const { error: notifyError, success: notifySuccess } = useNotification();
	const { content, setContent, tags, selectedProject, error, isSaving, save, removeTag, clear } =
		useQuickCapture({
			onEntrySaved: incrementJournalEntriesCreated,
		});
	// Saved-and-closing state: when set, the success bar (Open / Undo) is shown
	// in place of the editor actions while the window waits to auto-close.
	const [savedEntry, setSavedEntry] = useState<SavedEntryInfo | null>(null);
	const [showSavedFlash, setShowSavedFlash] = useState(false);
	const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => {
		return () => {
			if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
			if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
		};
	}, []);

	// Capture time, stamped once when the window opens — a quiet "now" cue.
	const capturedAt = useMemo(
		() => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
		[],
	);
	const targetAlias = selectedProject ? selectedProject.replace(/^@/, "") : null;

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
				notifyError("Failed to load projects");
			} finally {
				setIsLoading(false);
			}
		};

		loadProjects();
	}, [notifyError]);

	const handleClose = useCallback(() => {
		try {
			Window.Close();
		} catch {
			// Window.Close may not be available in tests
		}
	}, []);

	const handleAutocompleteOpenChange = useCallback((isOpen: boolean) => {
		isAutocompleteOpenRef.current = isOpen;
	}, []);

	const cancelPendingClose = useCallback(() => {
		if (closeTimeoutRef.current) {
			clearTimeout(closeTimeoutRef.current);
			closeTimeoutRef.current = undefined;
		}
	}, []);

	// Undo a just-saved entry: cancel the pending auto-close, delete it, and
	// return to an empty editor so the user can keep capturing.
	const handleUndo = useCallback(
		async (entry: SavedEntryInfo) => {
			cancelPendingClose();
			setSavedEntry(null);
			try {
				await DeleteEntry(entry.projectAlias, entry.date, entry.id);
				notifySuccess("Entry deleted");
			} catch (err) {
				BackendLogger.error("Failed to undo entry:", err);
				notifyError("Failed to undo");
			}
		},
		[cancelPendingClose, notifySuccess, notifyError],
	);

	// Open the saved entry in the main window. Quick Capture is a separate Wails
	// window, so it can't drive the main router directly: emit a cross-window
	// event the main window listens for, focus that window, then close here.
	const handleOpen = useCallback(
		(entry: SavedEntryInfo) => {
			cancelPendingClose();
			try {
				Events.Emit(NAVIGATE_JOURNAL_EVENT, {
					projectAlias: entry.projectAlias,
					date: entry.date,
				});
				void ShowWindow();
			} catch (err) {
				BackendLogger.error("Failed to open entry:", err);
			}
			handleClose();
		},
		[cancelPendingClose, handleClose],
	);

	const handleSave = useCallback(
		async (keepOpen: boolean = false) => {
			const result = await save();
			if (!result) return;

			if (keepOpen) {
				// Stay open for the next note — a brief in-window flash confirms.
				setShowSavedFlash(true);
				if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
				flashTimeoutRef.current = setTimeout(() => setShowSavedFlash(false), FLASH_DURATION_MS);
			} else {
				// Show the success bar (Open / Undo) and auto-close after a beat.
				setSavedEntry(result);
				cancelPendingClose();
				closeTimeoutRef.current = setTimeout(() => handleClose(), SAVE_CLOSE_DELAY_MS);
			}
		},
		[save, handleClose, cancelPendingClose],
	);

	// Cancel: close immediately when empty; otherwise require a confirming second
	// press/click so in-progress text isn't lost to a stray Esc. Shared by the
	// Esc hotkey and the footer Cancel button.
	const handleCancel = useCallback(() => {
		if (!content.trim()) {
			handleClose();
		} else if (showEscapeHint) {
			clear();
			handleClose();
		} else {
			setShowEscapeHint(true);
		}
	}, [content, showEscapeHint, clear, handleClose]);

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{
				...QUICK_CAPTURE_SHORTCUTS.save,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					if (event.repeat) return;
					void handleSave(false);
				},
				allowInInput: true,
				capture: true,
			},
			{
				...QUICK_CAPTURE_SHORTCUTS.saveAndStay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					if (event.repeat) return;
					void handleSave(true);
				},
				allowInInput: true,
				capture: true,
			},
			{
				...QUICK_CAPTURE_SHORTCUTS.cancel,
				handler: (event: KeyboardEvent) => {
					if (isAutocompleteOpenRef.current) return false;
					event.preventDefault();
					handleCancel();
				},
				allowInInput: true,
				capture: true,
			},
		],
		[handleSave, handleCancel],
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
			<div className="flex h-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface font-sans text-sm text-text-dim">
				<span>Loading…</span>
			</div>
		);
	}

	return (
		<div
			className="qc-enter flex h-full w-full select-none flex-col overflow-hidden rounded-xl border border-border bg-surface font-sans text-sm text-text shadow-[var(--elevation-3)]"
			style={{ "--wails-draggable": "drag" } as React.CSSProperties}
		>
			{/* Header — mode + live destination. Doubles as the window drag handle. */}
			<header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
				<div className="flex items-center gap-2 text-text">
					<PenLine className="h-4 w-4 text-accent" aria-hidden="true" />
					<span className="text-sm font-medium">Quick note</span>
				</div>
				<div className="flex items-center gap-2">
					{targetAlias ? (
						<span className="rounded-md bg-accent/12 px-2 py-0.5 text-xs font-medium text-accent">
							@{targetAlias}
						</span>
					) : (
						<span className="text-xs text-text-dim">Type @ to set project</span>
					)}
					<span className="text-xs tabular-nums text-text-dim">{capturedAt}</span>
				</div>
			</header>

			{/* Composer */}
			<div
				className="min-h-0 flex-1 px-3 py-2"
				style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
			>
				<QuickEditor
					value={content}
					onChange={setContent}
					onKeyDown={handleKeyDown}
					onAutocompleteOpenChange={handleAutocompleteOpenChange}
					projects={projects}
					autoFocus
					maxLength={10000}
					className="h-full"
				/>
			</div>

			{(tags.length > 0 || error || showEscapeHint || showSavedFlash) && (
				<div
					className="shrink-0 space-y-1 px-3 pb-1"
					style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
				>
					{tags.length > 0 && <TagChips tags={tags} onRemove={removeTag} />}
					{error && <div className="text-xs text-red">{error}</div>}
					{showEscapeHint && <div className="text-xs text-text-dim">Press Esc again to discard</div>}
					{showSavedFlash && <div className="text-xs text-emerald-400">Saved ✓</div>}
				</div>
			)}

			{/* Action bar — swaps to a success bar with Open / Undo after a save-and-close. */}
			<footer
				className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2.5"
				style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
			>
				{savedEntry ? (
					<>
						<span className="flex items-center gap-1.5 text-xs">
							<span className="font-medium text-emerald-400">Saved ✓</span>
							<span className="text-text-dim">to {savedEntry.projectAlias}</span>
						</span>
						<div className="flex items-center gap-1.5">
							<FooterAction label="Open" onClick={() => handleOpen(savedEntry)} />
							<FooterAction label="Undo" onClick={() => void handleUndo(savedEntry)} />
						</div>
					</>
				) : (
					<>
						<div className="flex items-center gap-1.5">
							<Button
								variant="primary"
								size="sm"
								disabled={isSaving}
								onClick={() => void handleSave(false)}
							>
								Save
								<span className="ml-1.5 font-mono text-[11px] opacity-70">Ctrl ↵</span>
							</Button>
							<FooterAction
								kbd="Shift ↵"
								label="Save & New"
								disabled={isSaving}
								onClick={() => void handleSave(true)}
							/>
						</div>
						<FooterAction kbd="Esc" label="Cancel" onClick={handleCancel} />
					</>
				)}
			</footer>
		</div>
	);
};

const FooterAction: React.FC<{
	kbd?: string;
	label: string;
	onClick: () => void;
	disabled?: boolean;
}> = ({ kbd, label, onClick, disabled }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-dim transition-colors hover:bg-accent/8 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none"
	>
		{kbd && <Kbd className="text-[10px]">{kbd}</Kbd>}
		<span>{label}</span>
	</button>
);
