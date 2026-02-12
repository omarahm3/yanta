import { FileText, Search } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMergedConfig } from "../../config";
import { useProjectContext } from "../../project";
import { type RecentDocument, useRecentDocuments } from "../../shared/hooks";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
import { cn } from "../../shared/utils/cn";
import { formatRelativeTimeFromTimestamp } from "../../shared/utils/date";
import { usePaneLayout } from "..";

interface DisplayItem {
	path: string;
	title: string;
	projectAlias: string;
	lastOpened: number;
}

export interface EmptyPaneDocumentPickerProps {
	paneId: string;
	isDragOver?: boolean;
	onClose?: () => void;
}

function recentToDisplayItem(doc: RecentDocument): DisplayItem {
	return {
		path: doc.path,
		title: doc.title,
		projectAlias: doc.projectAlias,
		lastOpened: doc.lastOpened,
	};
}

export const EmptyPaneDocumentPicker: React.FC<EmptyPaneDocumentPickerProps> = ({
	paneId,
	isDragOver = false,
	onClose,
}) => {
	const [query, setQuery] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const [searchResults, setSearchResults] = useState<DisplayItem[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { timeouts } = useMergedConfig();
	const { recentDocuments, removeRecentDocument } = useRecentDocuments();
	const { projects } = useProjectContext();
	const { openDocumentInPane, setActivePane, activePaneId } = usePaneLayout();

	const projectsRef = useRef(projects);
	projectsRef.current = projects;
	const recentDocumentsRef = useRef(recentDocuments);
	recentDocumentsRef.current = recentDocuments;
	const removeRecentDocumentRef = useRef(removeRecentDocument);
	removeRecentDocumentRef.current = removeRecentDocument;

	const [validPaths, setValidPaths] = useState<Set<string> | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function validateRecents() {
			const paths = new Set<string>();
			const results = await Promise.all(
				projectsRef.current.map((p) => DocumentServiceWrapper.listByProject(p.alias).catch(() => [])),
			);
			for (const docs of results) {
				for (const doc of docs) {
					paths.add(doc.path);
				}
			}
			if (cancelled) return;
			setValidPaths(paths);
			for (const d of recentDocumentsRef.current) {
				if (!paths.has(d.path)) {
					removeRecentDocumentRef.current(d.path);
				}
			}
		}
		validateRecents();
		return () => {
			cancelled = true;
		};
	}, []);

	const filteredRecents = validPaths
		? recentDocuments.filter((d) => validPaths.has(d.path)).map(recentToDisplayItem)
		: recentDocuments.map(recentToDisplayItem);

	const displayItems = query === "" ? filteredRecents : searchResults;

	useEffect(() => {
		if (activePaneId === paneId) {
			inputRef.current?.focus();
		}
	}, [activePaneId, paneId]);

	useEffect(() => {
		if (query === "") {
			setSearchResults([]);
			setHighlightedIndex(0);
			return;
		}

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(async () => {
			const lowerQuery = query.toLowerCase();
			const allDocs: DisplayItem[] = [];

			const results = await Promise.all(
				projectsRef.current.map((project) =>
					DocumentServiceWrapper.listByProject(project.alias).catch(() => []),
				),
			);

			for (const docs of results) {
				for (const doc of docs) {
					if (doc.title.toLowerCase().includes(lowerQuery)) {
						allDocs.push({
							path: doc.path,
							title: doc.title,
							projectAlias: doc.projectAlias,
							lastOpened: doc.updated.getTime(),
						});
					}
				}
			}

			const seen = new Set<string>();
			const deduped = allDocs.filter((item) => {
				if (seen.has(item.path)) return false;
				seen.add(item.path);
				return true;
			});

			setSearchResults(deduped.slice(0, 20));
			setHighlightedIndex(0);
		}, timeouts.documentPickerFilterDebounceMs);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [query]);

	const openItem = useCallback(
		(item: DisplayItem) => {
			openDocumentInPane(paneId, item.path);
			setActivePane(paneId);
			onClose?.();
		},
		[paneId, openDocumentInPane, setActivePane, onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape" && onClose) {
				e.preventDefault();
				onClose();
			} else if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
				e.preventDefault();
				setHighlightedIndex((prev) => Math.min(prev + 1, displayItems.length - 1));
			} else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
				e.preventDefault();
				setHighlightedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				const item = displayItems[highlightedIndex];
				if (item) {
					openItem(item);
				}
			}
		},
		[displayItems, highlightedIndex, openItem, onClose],
	);

	const handleHighlightIndex = useCallback((index: number) => {
		setHighlightedIndex(index);
	}, []);

	if (isDragOver) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 text-text-dim select-none transition-colors bg-accent/5">
				<FileText className="w-10 h-10 opacity-40" aria-hidden="true" />
				<p className="text-sm font-medium text-accent">Drop to open here</p>
			</div>
		);
	}

	return (
		<div
			className="flex flex-1 flex-col items-center pt-16 px-4 select-none"
			onKeyDown={handleKeyDown}
		>
			<div className="w-full max-w-sm flex flex-col gap-3">
				<div className="relative">
					<Search
						className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim opacity-50"
						aria-hidden="true"
					/>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search documents..."
						className="w-full pl-9 pr-3 py-2 text-sm bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md text-text placeholder:text-text-dim/50 focus:outline-none focus:ring-1 focus:ring-accent"
					/>
				</div>

				<p className="text-xs text-text-dim opacity-60 uppercase tracking-wider px-1">
					{query === "" ? "Recent" : "Results"}
				</p>

				<div className="flex flex-col max-h-80 overflow-y-auto">
					{displayItems.length === 0 ? (
						<p className="text-sm text-text-dim opacity-60 text-center py-4">
							{query === "" ? "No recent documents" : "No matching documents"}
						</p>
					) : (
						displayItems.map((item, index) => (
							<PickerItemRow
								key={item.path}
								item={item}
								index={index}
								isHighlighted={index === highlightedIndex}
								openItem={openItem}
								onHighlight={handleHighlightIndex}
							/>
						))
					)}
				</div>

				<p className="text-xs text-text-dim opacity-40 text-center pt-2">
					↑↓/C-n/C-p navigate · Enter open · Esc {onClose ? "close" : "back"}
				</p>
			</div>
		</div>
	);
};

interface PickerItemRowProps {
	item: DisplayItem;
	index: number;
	isHighlighted: boolean;
	openItem: (item: DisplayItem) => void;
	onHighlight: (index: number) => void;
}

const PickerItemRow: React.FC<PickerItemRowProps> = React.memo(
	({ item, index, isHighlighted, openItem, onHighlight }) => (
		<button
			type="button"
			className={cn(
				"flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer",
				isHighlighted ? "bg-accent/10 text-text" : "text-text-dim hover:bg-glass-bg/20",
			)}
			onClick={() => openItem(item)}
			onMouseEnter={() => onHighlight(index)}
		>
			<FileText className="w-4 h-4 shrink-0 opacity-40" aria-hidden="true" />
			<div className="flex flex-col min-w-0 flex-1">
				<span className="text-sm truncate">{item.title}</span>
				<span className="text-xs opacity-50 truncate">
					@{item.projectAlias} · {formatRelativeTimeFromTimestamp(item.lastOpened)}
				</span>
			</div>
		</button>
	),
);
PickerItemRow.displayName = "PickerItemRow";
