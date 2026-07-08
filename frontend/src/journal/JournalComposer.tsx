import { useCallback, useState } from "react";
import { Button } from "../shared/ui";
import { Kbd } from "../shared/ui/Kbd";

export interface JournalComposerProps {
	/** Append raw text (with inline #tags) to the currently-viewed day. */
	onAdd: (rawText: string) => Promise<void>;
	/** Formatted Quick Capture hotkey, shown as a hint. */
	hotkeyHint: string;
	className?: string;
}

/**
 * In-page journal capture. Writes to the currently-viewed date (unlike the
 * global Quick Capture, which always targets today) so entries can be added to
 * any day without leaving the journal.
 */
export const JournalComposer: React.FC<JournalComposerProps> = ({
	onAdd,
	hotkeyHint,
	className,
}) => {
	const [text, setText] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const submit = useCallback(async () => {
		const trimmed = text.trim();
		if (!trimmed || isSaving) return;
		setIsSaving(true);
		try {
			await onAdd(trimmed);
			setText("");
		} catch {
			// The hook logs and notifies; keep the text so the user can retry.
		} finally {
			setIsSaving(false);
		}
	}, [text, isSaving, onAdd]);

	return (
		<div className={className}>
			<textarea
				value={text}
				disabled={isSaving}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (isSaving) return;
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						void submit();
					}
				}}
				rows={2}
				placeholder="Add an entry to this day…  (#tags supported)"
				aria-label="Add journal entry"
				className="w-full resize-y rounded-md border border-border bg-bg-dark px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
			/>
			<div className="mt-2 flex items-center gap-2 text-xs text-text-dim">
				<Button size="sm" onClick={() => void submit()} disabled={!text.trim() || isSaving}>
					{isSaving ? "Adding…" : "Add entry"}
				</Button>
				<span className="flex items-center gap-1">
					<Kbd>⌘/Ctrl</Kbd>
					<span>+</span>
					<Kbd>Enter</Kbd>
					<span>to add</span>
				</span>
				<span className="ml-auto flex items-center gap-1">
					<span>Quick Capture:</span>
					<Kbd>{hotkeyHint}</Kbd>
				</span>
			</div>
		</div>
	);
};
