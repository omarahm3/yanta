import { ClipboardCopy, FileText, NotebookPen, Search } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useProjectContext } from "../project";
import { getFinderUnsupportedWarning } from "../search-index/queryParser";
import { useNotification } from "../shared/hooks";
import { useDocumentCommandStore } from "../shared/stores/documentCommand.store";
import type { NavigationState, PageName } from "../shared/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../shared/ui/dialog";
import { Kbd } from "../shared/ui/Kbd";
import { cn } from "../shared/utils/cn";
import { GlobalSearchPreview } from "./GlobalSearchPreview";
import { useGlobalSearchStore } from "./globalSearch.store";
import type { FinderItem } from "./types";
import { useDocumentSearch } from "./useDocumentSearch";

interface GlobalSearchProps {
	onNavigate: (page: PageName, state?: NavigationState) => void;
}

/**
 * Global document finder (⌘F) — a keyboard-first overlay: a ranked result list
 * on the left, a live document preview on the right. Summonable from anywhere.
 * The heavy data hooks live in the inner component so they only run while the
 * finder is open.
 */
export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
	const isOpen = useGlobalSearchStore((s) => s.isOpen);
	const close = useGlobalSearchStore((s) => s.close);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) close();
		},
		[close],
	);

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			{isOpen && <GlobalSearchInner onNavigate={onNavigate} onClose={close} />}
		</Dialog>
	);
}

function GlobalSearchInner({
	onNavigate,
	onClose,
}: {
	onNavigate: (page: PageName, state?: NavigationState) => void;
	onClose: () => void;
}) {
	const { projects, setCurrentProject } = useProjectContext();
	const {
		query,
		setQuery,
		items,
		isLoading,
		error,
		hasQuery,
		isUpdating,
		isError,
		rebuild,
		recentError,
		retryRecent,
	} = useDocumentSearch();
	const lastQuery = useGlobalSearchStore((s) => s.lastQuery);
	const setLastQuery = useGlobalSearchStore((s) => s.setLastQuery);
	const { success: notifySuccess } = useNotification();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listId = useId();
	const optionId = (index: number) => `${listId}-opt-${index}`;

	// Restore last query on open and focus the search box.
	useEffect(() => {
		if (lastQuery) {
			setQuery(lastQuery);
		}
		inputRef.current?.focus();
	}, []);

	// Persist query on close.
	useEffect(() => {
		return () => {
			setLastQuery(query);
		};
	}, [query, setLastQuery]);

	// New result set → jump selection back to the top.
	useEffect(() => {
		setSelectedIndex(0);
	}, [items]);

	const safeIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1);
	const selected = items[safeIndex];

	const openItem = useCallback(
		(item: FinderItem | undefined, split = false) => {
			if (!item) return;
			// Aliases may or may not carry a leading "@" depending on the source;
			// compare without it so the active project still switches correctly.
			const alias = (item.projectAlias || item.path.split("/")[1] || "").replace(/^@+/, "");
			const target = projects.find((p) => p.alias.replace(/^@+/, "") === alias);
			if (target) setCurrentProject(target);

			if (item.type === "note") {
				onNavigate("journal", { date: item.updated, noteId: item.noteId });
			} else {
				onNavigate("document", {
					documentPath: item.path,
					...(split ? { openInSplit: true } : {}),
				});
				// Pass the query to the find bar so the doc opens at the match
				if (query.trim()) {
					// Use setTimeout to ensure navigation completes before triggering find
					setTimeout(() => {
						useDocumentCommandStore.getState().requestFind(query.trim());
					}, 0);
				}
			}
			onClose();
		},
		[projects, setCurrentProject, onNavigate, onClose, query],
	);

	const copyLink = useCallback(
		(item: FinderItem | undefined) => {
			if (!item) return;
			navigator.clipboard.writeText(item.path).then(() => {
				notifySuccess("Link copied");
			});
		},
		[notifySuccess],
	);

	const moveSelection = useCallback((delta: number) => {
		setSelectedIndex((prev) => {
			const count = itemCountRef.current;
			if (count === 0) return 0;
			return (prev + delta + count) % count;
		});
	}, []);

	// Keep the latest item count available to the stable moveSelection callback.
	const itemCountRef = useRef(items.length);
	itemCountRef.current = items.length;

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			const { key, ctrlKey, metaKey, shiftKey } = event;
			const mod = metaKey || ctrlKey;
			if (key === "ArrowDown" || (ctrlKey && (key === "n" || key === "j"))) {
				event.preventDefault();
				moveSelection(1);
			} else if (key === "ArrowUp" || (ctrlKey && (key === "p" || key === "k"))) {
				event.preventDefault();
				moveSelection(-1);
			} else if (key === "Enter") {
				event.preventDefault();
				if (mod && !shiftKey) {
					openItem(items[safeIndex], true);
				} else {
					openItem(items[safeIndex]);
				}
			}
			// Escape is handled by the Radix Dialog (closes the finder).
		},
		[moveSelection, openItem, items, safeIndex],
	);

	// Keep the highlighted row visible as selection moves.
	useEffect(() => {
		const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${safeIndex}"]`);
		el?.scrollIntoView({ block: "nearest" });
	}, [safeIndex]);

	const unsupportedWarning = useMemo(
		() => (hasQuery ? getFinderUnsupportedWarning(query) : null),
		[hasQuery, query],
	);

	return (
		<DialogContent
			showCloseButton={false}
			className="flex h-[min(70vh,560px)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden bg-surface p-0 sm:max-w-4xl"
		>
			<DialogTitle className="sr-only">Search all documents</DialogTitle>
			<DialogDescription className="sr-only">
				Search your documents and notes, then press Enter to open one.
			</DialogDescription>

			<div className="flex h-full flex-col" onKeyDown={handleKeyDown}>
				<div
					data-slot="command-input-wrapper"
					className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4"
				>
					<Search className="size-5 shrink-0 text-text-dim" aria-hidden="true" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search all documents and notes…"
						aria-label="Search all documents"
						role="combobox"
						aria-expanded={items.length > 0}
						aria-controls={listId}
						aria-autocomplete="list"
						aria-activedescendant={items.length > 0 ? optionId(safeIndex) : undefined}
						spellCheck={false}
						autoComplete="off"
						className="h-10 w-full bg-transparent text-lg text-text outline-none placeholder:text-text-dim"
					/>
					<Kbd className="px-2 py-1 text-xs">ESC</Kbd>
				</div>

				<div className="flex min-h-0 flex-1">
					<div
						ref={listRef}
						id={listId}
						role="listbox"
						aria-label="Search results"
						className="w-full shrink-0 overflow-y-auto p-1.5 md:w-2/5 md:border-r md:border-border"
					>
						{items.length === 0 ? (
							<ListEmpty
								hasQuery={hasQuery}
								isLoading={isLoading}
								query={query}
								error={error}
								isError={isError}
								onRebuild={rebuild}
								recentError={recentError}
								onRetryRecent={retryRecent}
							/>
						) : (
							items.map((item, index) => (
								<ResultRow
									key={item.key}
									id={optionId(index)}
									item={item}
									index={index}
									selected={index === safeIndex}
									onSelect={setSelectedIndex}
									onOpen={openItem}
									onCopyLink={copyLink}
								/>
							))
						)}
					</div>

					<div className="hidden min-h-0 flex-1 md:flex md:flex-col">
						<GlobalSearchPreview item={selected} />
					</div>
				</div>

				<div className="flex h-9 shrink-0 items-center gap-4 border-t border-border px-4 text-[11px] text-text-dim">
					<FooterHint keyLabel="↑↓" label="Navigate" />
					<FooterHint keyLabel="↵" label="Open" />
					<FooterHint keyLabel="⌘↵" label="Open in split" />
					<FooterHint keyLabel="esc" label="Close" />
					{unsupportedWarning ? (
						<span className="ml-auto text-yellow truncate max-w-[50%]" title={unsupportedWarning}>
							{unsupportedWarning}
						</span>
					) : isUpdating && hasQuery ? (
						<span className="ml-auto text-yellow">Updating index…</span>
					) : hasQuery && items.length > 0 ? (
						<span className="ml-auto">
							{items.length} {items.length === 1 ? "result" : "results"}
						</span>
					) : null}
				</div>
			</div>
		</DialogContent>
	);
}

interface ResultRowProps {
	id: string;
	item: FinderItem;
	index: number;
	selected: boolean;
	onSelect: (index: number) => void;
	onOpen: (item: FinderItem, split?: boolean) => void;
	onCopyLink: (item: FinderItem) => void;
}

function ResultRow({ id, item, index, selected, onSelect, onOpen, onCopyLink }: ResultRowProps) {
	const isNote = item.type === "note";
	const Icon = isNote ? NotebookPen : FileText;

	return (
		<div
			id={id}
			role="option"
			tabIndex={-1}
			data-index={index}
			aria-selected={selected}
			onMouseEnter={() => {
				if (!selected) onSelect(index);
			}}
			onClick={() => onOpen(item)}
			className={cn(
				"flex cursor-pointer flex-col gap-1 rounded-md px-3 py-2 text-sm transition-colors duration-150",
				selected ? "bg-accent/12 text-accent" : "text-text hover:bg-accent/[0.06]",
			)}
		>
			<div className="flex items-center gap-2.5">
				<Icon
					className={cn("size-4 shrink-0", selected ? "text-accent" : "text-text-dim")}
					aria-hidden="true"
				/>
				<span className="flex-1 truncate">{item.title || "Untitled"}</span>
				{item.projectAlias && (
					<span className="shrink-0 font-mono text-[11px] text-text-dim">
						@{item.projectAlias.replace(/^@+/, "")}
					</span>
				)}
				{item.matchCount > 0 && (
					<span className="shrink-0 text-[11px] text-text-dim">
						{item.matchCount} {item.matchCount === 1 ? "match" : "matches"}
					</span>
				)}
				{selected && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onCopyLink(item);
						}}
						className="shrink-0 rounded p-1 hover:bg-accent/20 transition-colors"
						title="Copy link"
						aria-label="Copy link"
					>
						<ClipboardCopy className="size-3.5" aria-hidden="true" />
					</button>
				)}
			</div>
			{item.snippets.length > 0 && (
				<div
					className="truncate text-xs text-text-dim [&_mark]:bg-yellow/20 [&_mark]:text-yellow [&_mark]:px-0.5 [&_mark]:rounded"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: snippets are trusted HTML from buildSnippet with only <mark> tags
					dangerouslySetInnerHTML={{ __html: item.snippets[0] }}
				/>
			)}
		</div>
	);
}

function ListEmpty({
	isError,
	onRebuild,
	hasQuery,
	isLoading,
	query,
	error,
	recentError,
	onRetryRecent,
}: {
	hasQuery: boolean;
	isLoading: boolean;
	query: string;
	error: string | null;
	isError: boolean;
	onRebuild: () => void;
	recentError: string | null;
	onRetryRecent: () => void;
}) {
	if (isError) {
		return (
			<div className="flex flex-col items-center gap-3 px-3 py-12 text-center text-sm">
				<span className="text-red">{error || "Search index unavailable."}</span>
				<button
					type="button"
					onClick={onRebuild}
					className="rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
				>
					Rebuild Index
				</button>
			</div>
		);
	}
	if (recentError && !hasQuery) {
		return (
			<div className="flex flex-col items-center gap-3 px-3 py-12 text-center text-sm">
				<span className="text-red">{recentError}</span>
				<button
					type="button"
					onClick={onRetryRecent}
					className="rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
				>
					Retry
				</button>
			</div>
		);
	}
	if (isLoading) {
		return <div className="px-3 py-12 text-center text-sm text-text-dim">Searching…</div>;
	}
	if (hasQuery) {
		return (
			<div className="flex flex-col items-center gap-1 px-3 py-12 text-center text-sm text-text-dim">
				<span>No matches for “{query.trim()}”</span>
				<span className="text-xs">
					Try fewer words, or filters like <span className="font-mono text-accent">project:</span>{" "}
					<span className="font-mono text-accent">tag:</span>
				</span>
			</div>
		);
	}
	return (
		<div className="px-3 py-12 text-center text-sm text-text-dim">
			Type to search your documents and notes.
		</div>
	);
}

function FooterHint({ keyLabel, label }: { keyLabel: string; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<Kbd className="text-[10px]">{keyLabel}</Kbd>
			<span>{label}</span>
		</span>
	);
}
