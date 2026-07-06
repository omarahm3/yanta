import { ChevronDown, ChevronUp, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { useHotkey } from "../../hotkeys";
import { cn } from "../../shared/utils/cn";
import type { EditorHandle } from "../types";
import "./find.css";
import { useEditorFind } from "./useEditorFind";

interface FindBarProps {
	editor: EditorHandle;
	onClose: () => void;
}

const iconButton =
	"flex h-6 w-6 items-center justify-center rounded text-text-dim transition-colors hover:bg-accent/10 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * Floating find bar for the open document. Highlights matches live via the find
 * plugin (see useEditorFind), shows "N of M", and navigates with Enter /
 * Shift+Enter or the arrow buttons. Escape closes it (registered capture-phase
 * with high priority so it beats the document's "back" handler).
 */
export function FindBar({ editor, onClose }: FindBarProps) {
	const find = useEditorFind(editor);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	useHotkey({
		key: "Escape",
		handler: (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClose();
		},
		allowInInput: true,
		capture: true,
		priority: 100,
		description: "Close find",
	});

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			if (event.shiftKey) find.prev();
			else find.next();
		}
	};

	const status = find.query
		? find.matchCount > 0
			? `${find.activeIndex + 1} of ${find.matchCount}`
			: "No results"
		: "";

	return (
		<div
			role="search"
			onKeyDown={handleKeyDown}
			className="absolute right-4 top-3 z-20 flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1 shadow-lg"
		>
			<input
				ref={inputRef}
				type="text"
				value={find.query}
				onChange={(e) => find.setQuery(e.target.value)}
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
				disabled={find.matchCount === 0}
				title="Previous match (Shift+Enter)"
				aria-label="Previous match"
				className={iconButton}
			>
				<ChevronUp className="size-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={() => find.next()}
				disabled={find.matchCount === 0}
				title="Next match (Enter)"
				aria-label="Next match"
				className={iconButton}
			>
				<ChevronDown className="size-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={onClose}
				title="Close (Esc)"
				aria-label="Close find"
				className={iconButton}
			>
				<X className="size-4" aria-hidden="true" />
			</button>
		</div>
	);
}
