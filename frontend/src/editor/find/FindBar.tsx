import { ChevronDown, ChevronRight, ChevronUp, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useHotkey } from "../../hotkeys";
import { cn } from "../../shared/utils/cn";
import type { EditorHandle } from "../types";
import "./find.css";
import { useEditorFind } from "./useEditorFind";

interface FindBarProps {
	editor: EditorHandle;
	onClose: () => void;
	/** Whether the replace row is shown. */
	showReplace?: boolean;
	/** Toggle the replace row (also opens find if closed). */
	onToggleReplace?: () => void;
}

const iconButton =
	"flex h-6 w-6 items-center justify-center rounded text-text-dim transition-colors hover:bg-accent/10 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent";

const textButton =
	"flex h-6 items-center rounded px-2 text-xs font-medium text-text-dim transition-colors hover:bg-accent/10 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * Floating find/replace bar for the open document. Highlights matches live via
 * the find plugin (see useEditorFind), shows "N of M", navigates with Enter /
 * Shift+Enter, and can replace the active match or all matches. Escape closes it
 * (registered capture-phase with high priority so it beats the document's "back"
 * handler) and returns focus to the editor so a following Escape blurs the
 * editor rather than ejecting to the dashboard.
 */
export function FindBar({ editor, onClose, showReplace = false, onToggleReplace }: FindBarProps) {
	const find = useEditorFind(editor);
	const inputRef = useRef<HTMLInputElement>(null);
	const replaceInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	// Focus the replace field when the replace row is revealed.
	useEffect(() => {
		if (showReplace) replaceInputRef.current?.focus();
	}, [showReplace]);

	// Return focus to the editor (caret sits on the active match) so the document
	// Escape handler blurs the editor next, instead of navigating away.
	const handleClose = useCallback(() => {
		try {
			editor.prosemirrorView?.focus();
		} catch {
			// A transient/destroyed view can't take focus; closing still proceeds.
		}
		onClose();
	}, [editor, onClose]);

	useHotkey({
		key: "Escape",
		handler: (event) => {
			event.preventDefault();
			event.stopPropagation();
			handleClose();
		},
		allowInInput: true,
		capture: true,
		priority: 100,
		description: "Close find",
	});

	const handleFindKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			if (event.shiftKey) find.prev();
			else find.next();
		}
	};

	const handleReplaceKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			if (event.shiftKey) find.replaceAll();
			else find.replaceCurrent();
		}
	};

	const status = find.query
		? find.matchCount > 0
			? `${find.activeIndex + 1} of ${find.matchCount}`
			: "No results"
		: "";

	const noMatches = find.matchCount === 0;

	return (
		<div
			role="search"
			className="absolute right-4 top-3 z-20 flex flex-col gap-1 rounded-md border border-border bg-surface px-1.5 py-1 shadow-lg"
		>
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={onToggleReplace}
					aria-expanded={showReplace}
					aria-label={showReplace ? "Hide replace" : "Show replace"}
					title="Toggle replace"
					className={iconButton}
				>
					<ChevronRight
						className={cn("size-4 transition-transform", showReplace && "rotate-90")}
						aria-hidden="true"
					/>
				</button>
				<input
					ref={inputRef}
					type="text"
					value={find.query}
					onChange={(e) => find.setQuery(e.target.value)}
					onKeyDown={handleFindKeyDown}
					placeholder="Find in document…"
					aria-label="Find in document"
					spellCheck={false}
					autoComplete="off"
					className="h-7 w-48 bg-transparent px-1 text-sm text-text outline-none placeholder:text-text-dim"
				/>
				<span className="min-w-[4.5rem] shrink-0 text-right text-xs tabular-nums text-text-dim">
					{status}
				</span>
				<button
					type="button"
					onClick={() => find.toggleCaseSensitive()}
					aria-pressed={find.caseSensitive}
					title="Match case"
					className={cn(
						"flex h-6 w-6 items-center justify-center rounded text-xs font-semibold transition-colors hover:bg-accent/10",
						find.caseSensitive ? "bg-accent/15 text-accent" : "text-text-dim hover:text-text",
					)}
				>
					Aa
				</button>
				<button
					type="button"
					onClick={() => find.prev()}
					disabled={noMatches}
					title="Previous match (Shift+Enter)"
					aria-label="Previous match"
					className={iconButton}
				>
					<ChevronUp className="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					onClick={() => find.next()}
					disabled={noMatches}
					title="Next match (Enter)"
					aria-label="Next match"
					className={iconButton}
				>
					<ChevronDown className="size-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					onClick={handleClose}
					title="Close (Esc)"
					aria-label="Close find"
					className={iconButton}
				>
					<X className="size-4" aria-hidden="true" />
				</button>
			</div>

			{showReplace && (
				<div className="flex items-center gap-1">
					<span className="h-6 w-6 shrink-0" aria-hidden="true" />
					<input
						ref={replaceInputRef}
						type="text"
						value={find.replaceValue}
						onChange={(e) => find.setReplaceValue(e.target.value)}
						onKeyDown={handleReplaceKeyDown}
						placeholder="Replace with…"
						aria-label="Replace with"
						spellCheck={false}
						autoComplete="off"
						className="h-7 w-48 bg-transparent px-1 text-sm text-text outline-none placeholder:text-text-dim"
					/>
					<button
						type="button"
						onClick={() => find.replaceCurrent()}
						disabled={noMatches}
						title="Replace (Enter)"
						className={textButton}
					>
						Replace
					</button>
					<button
						type="button"
						onClick={() => find.replaceAll()}
						disabled={noMatches}
						title="Replace all (Shift+Enter)"
						className={textButton}
					>
						All
					</button>
				</div>
			)}
		</div>
	);
}
