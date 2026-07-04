import { FileText, NotebookPen, Search } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useProjectContext } from "../project";
import type { NavigationState, PageName } from "../shared/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../shared/ui/dialog";
import { Kbd } from "../shared/ui/Kbd";
import { cn } from "../shared/utils/cn";
import { GlobalSearchPreview } from "./GlobalSearchPreview";
import { useGlobalSearchStore } from "./globalSearch.store";
import { extractSearchTerms } from "./highlight";
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
	const { query, setQuery, items, isLoading, error, hasQuery } = useDocumentSearch();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listId = useId();
	const optionId = (index: number) => `${listId}-opt-${index}`;

	const terms = useMemo(() => extractSearchTerms(query), [query]);

	// Focus the search box as soon as the finder opens.
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// New result set → jump selection back to the top.
	useEffect(() => {
		setSelectedIndex(0);
	}, [items]);

	const safeIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1);
	const selected = items[safeIndex];

	const openItem = useCallback(
		(item: FinderItem | undefined) => {
			if (!item) return;
			const alias = item.projectAlias || item.path.split("/")[1];
			const target = projects.find((p) => p.alias === alias);
			if (target) setCurrentProject(target);

			if (item.type === "note") {
				onNavigate("journal", { date: item.updated, noteId: item.noteId });
			} else {
				onNavigate("document", { documentPath: item.path });
			}
			onClose();
		},
		[projects, setCurrentProject, onNavigate, onClose],
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
			const { key, ctrlKey } = event;
			if (key === "ArrowDown" || (ctrlKey && (key === "n" || key === "j"))) {
				event.preventDefault();
				moveSelection(1);
			} else if (key === "ArrowUp" || (ctrlKey && (key === "p" || key === "k"))) {
				event.preventDefault();
				moveSelection(-1);
			} else if (key === "Enter") {
				event.preventDefault();
				openItem(items[safeIndex]);
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
							<ListEmpty hasQuery={hasQuery} isLoading={isLoading} query={query} error={error} />
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
								/>
							))
						)}
					</div>

					<div className="hidden min-h-0 flex-1 md:flex md:flex-col">
						<GlobalSearchPreview item={selected} terms={terms} />
					</div>
				</div>

				<div className="flex h-9 shrink-0 items-center gap-4 border-t border-border px-4 text-[11px] text-text-dim">
					<FooterHint keyLabel="↑↓" label="Navigate" />
					<FooterHint keyLabel="↵" label="Open" />
					<FooterHint keyLabel="esc" label="Close" />
					{isLoading && hasQuery ? (
						<span className="ml-auto text-yellow">Searching…</span>
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
	onOpen: (item: FinderItem) => void;
}

function ResultRow({ id, item, index, selected, onSelect, onOpen }: ResultRowProps) {
	const isNote = item.type === "note";
	const Icon = isNote ? NotebookPen : FileText;

	return (
		<div
			id={id}
			role="option"
			tabIndex={-1}
			data-index={index}
			aria-selected={selected}
			onMouseMove={() => {
				if (!selected) onSelect(index);
			}}
			onClick={() => onOpen(item)}
			className={cn(
				"flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150",
				selected ? "bg-accent/12 text-accent" : "text-text hover:bg-accent/[0.06]",
			)}
		>
			<Icon
				className={cn("size-4 shrink-0", selected ? "text-accent" : "text-text-dim")}
				aria-hidden="true"
			/>
			<span className="flex-1 truncate">{item.title || "Untitled"}</span>
			{item.projectAlias && (
				<span className="shrink-0 font-mono text-[11px] text-text-dim">@{item.projectAlias}</span>
			)}
			{item.matchCount > 1 && (
				<span className="shrink-0 text-[11px] text-text-dim">{item.matchCount}</span>
			)}
		</div>
	);
}

function ListEmpty({
	hasQuery,
	isLoading,
	query,
	error,
}: {
	hasQuery: boolean;
	isLoading: boolean;
	query: string;
	error: string | null;
}) {
	if (error) {
		return <div className="px-3 py-12 text-center text-sm text-red">{error}</div>;
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
