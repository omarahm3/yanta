import { Clock, FolderSearch, SearchX, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GranularErrorBoundary, Layout } from "@/app";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import type * as searchModels from "../../bindings/yanta/internal/search/models";
import { Query } from "../../bindings/yanta/internal/search/service";
import type * as tagModels from "../../bindings/yanta/internal/tag/models";
import { ListActive as ListActiveTags } from "../../bindings/yanta/internal/tag/service";
import { useHelp } from "../help";
import { useProjectContext } from "../project";
import { useNotification, useSidebarSections } from "../shared/hooks";
import type { NavigationState, PageName } from "../shared/types";
import { Button, EmptyState, Input } from "../shared/ui";
import { BackendLogger } from "../shared/utils/backendLogger";
import { SearchResultsSkeleton } from "./SearchResultsSkeleton";

const RECENT_SEARCHES_KEY = "yanta:recent-searches";
const MAX_RECENT = 10;

type TypeFilter = "all" | "document" | "note";
type DateFilter = "all" | "today" | "week" | "month";

function loadRecentSearches(): string[] {
	try {
		const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
	} catch {
		return [];
	}
}

function saveRecentSearches(searches: string[]) {
	try {
		localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)));
	} catch {
		/* localStorage may be full; silently ignore */
	}
}

function addRecentSearch(query: string): string[] {
	const trimmed = query.trim();
	if (!trimmed) return loadRecentSearches();
	const current = loadRecentSearches();
	const filtered = current.filter((s) => s !== trimmed);
	return [trimmed, ...filtered].slice(0, MAX_RECENT);
}

function removeRecentSearch(query: string): string[] {
	const current = loadRecentSearches();
	return current.filter((s) => s !== query);
}

function isToday(dateStr: string): boolean {
	const today = new Date();
	const d = new Date(dateStr + "T00:00:00");
	return (
		d.getFullYear() === today.getFullYear() &&
		d.getMonth() === today.getMonth() &&
		d.getDate() === today.getDate()
	);
}

function isThisWeek(dateStr: string): boolean {
	const now = new Date();
	const dayOfWeek = now.getDay();
	const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	const monday = new Date(now);
	monday.setDate(now.getDate() - diffToMonday);
	monday.setHours(0, 0, 0, 0);
	const d = new Date(dateStr + "T00:00:00");
	return d >= monday;
}

function isThisMonth(dateStr: string): boolean {
	const now = new Date();
	const d = new Date(dateStr + "T00:00:00");
	return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

interface SearchResult {
	path: string;
	title: string;
	snippet: string;
	updated: string;
	type: "document" | "note";
	projectAlias: string;
	noteId?: string;
}

interface GroupedSearchResult {
	path: string;
	title: string;
	snippets: string[];
	updated: string;
	matchCount: number;
	type: "document" | "note";
	projectAlias: string;
	noteId?: string;
}

interface SearchProps {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const SearchComponent: React.FC<SearchProps> = ({ onNavigate, onRegisterToggleSidebar }) => {
	const [rawQuery, setRawQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [queryTime, setQueryTime] = useState<number>(0);
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
	const [dateFilter, setDateFilter] = useState<DateFilter>("all");
	const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
	const [showRecent, setShowRecent] = useState(false);

	const { timeouts } = useMergedConfig();
	const { error: notifyError } = useNotification();
	const { currentProject, projects, setCurrentProject } = useProjectContext();
	const { setPageContext } = useHelp();

	const [availableTags, setAvailableTags] = useState<string[]>([]);

	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const searchTimeoutRef = useRef<number | null>(null);
	const searchGenerationRef = useRef(0);
	const [resultsKey, setResultsKey] = useState(0);

	useEffect(() => {
		setPageContext([], "Search");
	}, [setPageContext]);

	useEffect(() => {
		searchInputRef.current?.focus();
	}, []);

	useEffect(() => {
		const loadTags = async () => {
			try {
				const tags = await ListActiveTags();
				const tagNames = tags
					.filter((t): t is tagModels.Tag => t !== null)
					.map((t) => t.name)
					.slice(0, 10);
				setAvailableTags(tagNames);
			} catch (err) {
				BackendLogger.error("Failed to load tags:", err);
				notifyError("Failed to load tags");
			}
		};
		loadTags();
	}, []);

	const addFilterToQuery = useCallback((filterType: "project" | "tag", value: string) => {
		const filterSyntax = `${filterType}:${value}`;
		setRawQuery((prev) => {
			const trimmed = prev.trim();
			if (!trimmed) {
				return filterSyntax;
			}
			if (trimmed.includes(filterSyntax)) {
				return prev;
			}
			return `${trimmed} ${filterSyntax}`;
		});
	}, []);

	const handleAddProjectFilter = useCallback(
		(alias: string) => {
			addFilterToQuery("project", alias);
		},
		[addFilterToQuery],
	);

	const handleAddTagFilter = useCallback(
		(tag: string) => {
			addFilterToQuery("tag", tag);
		},
		[addFilterToQuery],
	);

	const handleSeedProjectSearch = useCallback(() => {
		const targetAlias = currentProject?.alias ?? projects[0]?.alias;
		if (!targetAlias) {
			searchInputRef.current?.focus();
			return;
		}
		setRawQuery(`project:${targetAlias}`);
	}, [currentProject?.alias, projects]);

	const performSearch = useCallback(
		async (queryStr: string, requestGeneration: number) => {
			if (!queryStr.trim()) {
				setResults([]);
				setSearchError(null);
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setSearchError(null);
			const startTime = performance.now();

			try {
				const searchResults = await Query(queryStr, 50, 0);
				if (requestGeneration !== searchGenerationRef.current) return;

				const endTime = performance.now();
				setQueryTime(Math.round(endTime - startTime));

				if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
					setResults(
						searchResults
							.filter((r): r is searchModels.Result => r !== null)
							.map((r) => ({
								path: r.id,
								title: r.title,
								snippet: r.snippet,
								updated: r.updated,
								type: (r.type as "document" | "note") || "document",
								projectAlias: r.projectAlias || "",
								noteId: r.noteId,
							})),
					);
					setSelectedIndex(0);
					const updated = addRecentSearch(queryStr);
					saveRecentSearches(updated);
					setRecentSearches(updated);
				} else {
					setResults([]);
				}
			} catch (err) {
				if (requestGeneration !== searchGenerationRef.current) return;
				const errorMsg = err instanceof Error ? err.message : "Search failed";
				setSearchError(errorMsg);
				notifyError(`Search error: ${errorMsg}`);
				setResults([]);
			} finally {
				if (requestGeneration === searchGenerationRef.current) setIsLoading(false);
			}
		},
		[notifyError],
	);

	useEffect(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		searchGenerationRef.current += 1;
		const generation = searchGenerationRef.current;

		searchTimeoutRef.current = setTimeout(() => {
			performSearch(rawQuery, generation);
		}, timeouts.searchDebounceMs);

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, [rawQuery, performSearch]);

	const groupedResults = useMemo(() => {
		const groups = new Map<string, GroupedSearchResult>();

		results.forEach((result) => {
			const existing = groups.get(result.path);
			if (existing) {
				if (!existing.snippets.includes(result.snippet)) {
					existing.snippets.push(result.snippet);
					existing.matchCount += 1;
				}
			} else {
				groups.set(result.path, {
					path: result.path,
					title: result.title,
					snippets: [result.snippet],
					updated: result.updated,
					matchCount: 1,
					type: result.type,
					projectAlias: result.projectAlias,
					noteId: result.noteId,
				});
			}
		});

		return Array.from(groups.values());
	}, [results]);

	const filteredResults = useMemo(() => {
		let filtered = groupedResults;

		if (typeFilter !== "all") {
			filtered = filtered.filter((r) => r.type === typeFilter);
		}

		if (dateFilter !== "all") {
			filtered = filtered.filter((r) => {
				if (!r.updated) return false;
				switch (dateFilter) {
					case "today":
						return isToday(r.updated);
					case "week":
						return isThisWeek(r.updated);
					case "month":
						return isThisMonth(r.updated);
					default:
						return true;
				}
			});
		}

		return filtered;
	}, [groupedResults, typeFilter, dateFilter]);

	const displayResults = filteredResults;

	useEffect(() => {
		if (selectedIndex > displayResults.length - 1) {
			setSelectedIndex(Math.max(0, displayResults.length - 1));
		}
	}, [displayResults.length, selectedIndex]);

	useEffect(() => {
		setTypeFilter("all");
		setDateFilter("all");
	}, [rawQuery]);

	const openResult = useCallback(
		(index: number) => {
			const result = displayResults[index];
			if (!result) return;

			const projectAlias = result.projectAlias || result.path.split("/")[1];
			const targetProject = projects.find((p) => p.alias === projectAlias);
			if (targetProject) {
				setCurrentProject(targetProject);
			} else {
				BackendLogger.warn(`Project with alias '${projectAlias}' not found in active projects`);
			}

			if (result.type === "note") {
				onNavigate?.("journal", { date: result.updated, noteId: result.noteId });
			} else {
				onNavigate?.("document", { documentPath: result.path });
			}
		},
		[displayResults, onNavigate, projects, setCurrentProject],
	);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const focused = document.activeElement as HTMLElement | null;
			const isSearchInputFocused = focused === (searchInputRef.current as unknown as HTMLElement);

			if (e.key === "Escape" && showRecent) {
				setShowRecent(false);
				return;
			}

			if (e.key === "Tab" && isSearchInputFocused && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				setShowRecent(false);

				if (displayResults.length > 0) {
					const firstResult = document.querySelector('[data-result-item="true"]') as HTMLElement;
					if (firstResult) {
						firstResult.focus();
						setSelectedIndex(0);
					}
				} else {
					searchInputRef.current?.blur();
				}
				return;
			}

			if (e.key === "Escape" && isSearchInputFocused) {
				e.preventDefault();
				searchInputRef.current?.blur();
				if (displayResults.length > 0) {
					const firstResult = document.querySelector('[data-result-item="true"]') as HTMLElement;
					firstResult?.focus();
				}
				return;
			}

			if (isSearchInputFocused) return;
			if (focused?.tagName === "INPUT") return;

			if (e.key === "j") {
				e.preventDefault();
				setSelectedIndex((prev) => {
					const newIndex = Math.min(prev + 1, displayResults.length - 1);
					const resultElement = document.querySelectorAll('[data-result-item="true"]')[
						newIndex
					] as HTMLElement;
					resultElement?.focus();
					return newIndex;
				});
			} else if (e.key === "k") {
				e.preventDefault();
				setSelectedIndex((prev) => {
					const newIndex = Math.max(prev - 1, 0);
					const resultElement = document.querySelectorAll('[data-result-item="true"]')[
						newIndex
					] as HTMLElement;
					resultElement?.focus();
					return newIndex;
				});
			} else if (e.key === "/") {
				e.preventDefault();
				searchInputRef.current?.focus();
				searchInputRef.current?.select();
			} else if (e.key === "Enter" && focused && focused.dataset.resultItem === "true") {
				e.preventDefault();
				openResult(selectedIndex);
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [displayResults.length, openResult, selectedIndex, showRecent]);

	const sidebarSections = useSidebarSections({
		currentPage: "search",
		onNavigate,
	});

	const renderSnippet = (snippet: string) => {
		return <div className="leading-snug text-text" dangerouslySetInnerHTML={{ __html: snippet }} />;
	};

	return (
		<Layout
			sidebarSections={sidebarSections}
			currentPage="search"
			headerShortcuts={[
				{ key: "/", label: "focus search" },
				{ key: "Tab", label: "to results" },
				{ key: "j/k", label: "navigate" },
				{ key: "Enter", label: "open" },
				{ key: "Esc", label: "unfocus" },
			]}
			onRegisterToggleSidebar={onRegisterToggleSidebar}
		>
			<div className="flex flex-col h-full">
				<div className="p-4 border-b bg-transparent border-glass-border shrink-0 relative">
					<div className="flex items-center gap-3 mb-3">
						<span className="text-base text-accent">/</span>
						<Input
							ref={searchInputRef}
							variant="default"
							placeholder="Search entries... (try: project:alias, tag:name, title:text, -exclude, AND, OR)"
							value={rawQuery}
							onChange={(e) => setRawQuery((e.target as HTMLInputElement).value)}
							onFocus={() => setShowRecent(true)}
							onBlur={() => setTimeout(() => setShowRecent(false), 200)}
							className="flex-1 text-base bg-surface/80 border-border"
						/>
					</div>

					{showRecent && !rawQuery.trim() && recentSearches.length > 0 && (
						<div className="absolute top-full left-4 right-4 z-50 mt-1 p-3 bg-surface border border-border rounded-xl shadow-lg">
							<div className="flex items-center justify-between mb-2">
								<span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
									Recent
								</span>
								<button
									type="button"
									className="text-[11px] text-text-dim hover:text-text-bright transition-colors"
									onClick={(e) => {
										e.preventDefault();
										saveRecentSearches([]);
										setRecentSearches([]);
									}}
									onMouseDown={(e) => e.preventDefault()}
								>
									Clear all
								</button>
							</div>
							<div className="flex flex-wrap gap-2">
								{recentSearches.map((s) => (
									<div
										key={s}
										className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-bg/80 border border-border rounded-lg text-xs text-text-dim hover:text-text hover:border-accent/40 hover:bg-accent/5 transition-colors cursor-pointer"
										onMouseDown={(e) => {
											e.preventDefault();
											setRawQuery(s);
											setShowRecent(false);
										}}
									>
										<Clock className="h-3 w-3 shrink-0" />
										<span className="max-w-48 truncate">{s}</span>
										<button
											type="button"
											className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-text-dim transition-all"
											onMouseDown={(e) => {
												e.stopPropagation();
												e.preventDefault();
												const updated = removeRecentSearch(s);
												saveRecentSearches(updated);
												setRecentSearches(updated);
											}}
											aria-label={`Remove "${s}" from recent searches`}
										>
											<X className="h-3 w-3" />
										</button>
									</div>
								))}
							</div>
						</div>
					)}

					<div className="flex items-center gap-3 text-xs flex-wrap">
						{projects.slice(0, 10).map((p) => (
							<ProjectFilterButton key={p.alias} alias={p.alias} onAddFilter={handleAddProjectFilter} />
						))}

						<span className="px-1 text-text-dim">|</span>

						{availableTags.map((t) => (
							<TagFilterButton key={t} tag={t} onAddFilter={handleAddTagFilter} />
						))}
					</div>

					{groupedResults.length > 0 && (
						<div className="flex items-center gap-3 mt-3 pt-3 border-t border-glass-border text-xs flex-wrap">
							<span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim shrink-0">
								Type
							</span>
							{(["all", "note", "document"] as const).map((t) => (
								<FilterChip
									key={t}
									label={t === "all" ? "All" : t === "note" ? "Notes" : "Documents"}
									isActive={typeFilter === t}
									onClick={() => setTypeFilter(t)}
								/>
							))}

							<span className="mx-1 text-text-dim">|</span>

							<span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim shrink-0">
								Date
							</span>
							{(["all", "today", "week", "month"] as const).map((d) => (
								<FilterChip
									key={d}
									label={d === "all" ? "All time" : d === "today" ? "Today" : d === "week" ? "This week" : "This month"}
									isActive={dateFilter === d}
									onClick={() => setDateFilter(d)}
								/>
							))}

							{(typeFilter !== "all" || dateFilter !== "all") && (
								<button
									type="button"
									className="text-[11px] text-red/80 hover:text-red transition-colors ml-auto"
									onClick={() => {
										setTypeFilter("all");
										setDateFilter("all");
									}}
								>
									Clear filters
								</button>
							)}
						</div>
					)}
				</div>

				<div className="flex items-center justify-between px-5 py-2 text-xs border-b bg-glass-bg/10 border-glass-border text-text-dim shrink-0">
					<div className="flex gap-4">
						{isLoading ? (
							<span className="text-yellow">Searching...</span>
						) : (
							<>
								<span>
									Found{" "}
									<span className="font-semibold text-text">
										{displayResults.length}
									</span>{" "}
									{displayResults.length === 1 ? "result" : "results"}
									{typeFilter !== "all" || dateFilter !== "all" ? (
										<span className="text-text-dim ml-1">
											(filtered from {groupedResults.length})
										</span>
									) : null}
								</span>
								{queryTime > 0 && <span className="text-text-dim">in {queryTime}ms</span>}
							</>
						)}
					</div>
					<div className="flex gap-4">
						<span>Syntax:</span>
						<span className="font-mono text-accent">project:alias</span>
						<span className="font-mono text-accent">tag:name</span>
						<span className="font-mono text-accent">title:text</span>
						<span className="font-mono text-accent">body:text</span>
						<span className="font-mono text-accent">-exclude</span>
						<span className="font-mono text-accent">&quot;phrase&quot;</span>
						<span className="font-mono text-accent">AND OR</span>
					</div>
				</div>

				<div className="p-5 flex-1 overflow-y-auto">
					<GranularErrorBoundary
						key={resultsKey}
						message="Something went wrong in search results."
						onRetry={() => setResultsKey((k) => k + 1)}
					>
						{searchError ? (
							<div className="p-4 text-center bg-surface border border-red/30 rounded text-red">
								Error: {searchError}
							</div>
						) : isLoading && displayResults.length === 0 ? (
							<SearchResultsSkeleton />
						) : displayResults.length === 0 ? (
							groupedResults.length > 0 ? (
								<EmptyState
									icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
									title="No results match your filters"
									description="Try adjusting the type or date filter to see more results."
									actionLabel="Clear filters"
									onAction={() => {
										setTypeFilter("all");
										setDateFilter("all");
									}}
									className="min-h-[22rem]"
								/>
							) : rawQuery.trim() ? (
								<EmptyState
									icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
									title={`No matches for "${rawQuery.trim()}"`}
									description="Try fewer keywords or clear your filters to widen the search."
									actionLabel="Clear search"
									onAction={() => setRawQuery("")}
									className="min-h-[22rem]"
								/>
							) : (
								<EmptyState
									icon={<FolderSearch className="h-6 w-6" aria-hidden="true" />}
									title="Search your notes"
									description="Start with plain text or jump in with a project or tag filter."
									actionLabel={
										(currentProject?.alias ?? projects[0]?.alias)
											? `Search @${currentProject?.alias ?? projects[0]?.alias}`
											: "Focus search"
									}
									onAction={handleSeedProjectSearch}
									className="min-h-[22rem]"
								/>
							)
						) : (
							<div className="space-y-5">
								{displayResults.map((r, idx) => (
									<SearchResultCard
										key={r.path}
										result={r}
										index={idx}
										isSelected={idx === selectedIndex}
										onSelect={setSelectedIndex}
										onOpen={openResult}
										renderSnippet={renderSnippet}
									/>
								))}
							</div>
						)}
					</GranularErrorBoundary>
				</div>
			</div>
		</Layout>
	);
};

export const Search = React.memo(SearchComponent);

interface FilterChipProps {
	label: string;
	isActive: boolean;
	onClick: () => void;
}

const FilterChip: React.FC<FilterChipProps> = React.memo(({ label, isActive, onClick }) => {
	return (
		<button
			type="button"
			className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
				isActive
					? "bg-accent/15 text-accent border border-accent/30"
					: "text-text-dim hover:text-text hover:bg-surface border border-transparent"
			}`}
			onClick={onClick}
		>
			{label}
		</button>
	);
});

interface ProjectFilterButtonProps {
	alias: string;
	onAddFilter: (alias: string) => void;
}

const ProjectFilterButton: React.FC<ProjectFilterButtonProps> = React.memo(
	({ alias, onAddFilter }) => {
		const handleClick = useCallback(() => {
			onAddFilter(alias);
		}, [alias, onAddFilter]);

		return (
			<Button
				variant="ghost"
				size="sm"
				className="inline-flex items-center gap-1 border border-purple text-purple hover:bg-purple/10"
				onClick={handleClick}
			>
				{alias}
			</Button>
		);
	},
);

interface TagFilterButtonProps {
	tag: string;
	onAddFilter: (tag: string) => void;
}

const TagFilterButton: React.FC<TagFilterButtonProps> = React.memo(({ tag, onAddFilter }) => {
	const handleClick = useCallback(() => {
		onAddFilter(tag);
	}, [onAddFilter, tag]);

	return (
		<Button
			variant="ghost"
			size="sm"
			className="inline-flex items-center gap-1 border border-green text-green hover:bg-green/10"
			onClick={handleClick}
		>
			#{tag}
		</Button>
	);
});

interface SearchResultCardProps {
	result: GroupedSearchResult;
	index: number;
	isSelected: boolean;
	onSelect: (index: number) => void;
	onOpen: (index: number) => void;
	renderSnippet: (snippet: string) => React.ReactNode;
}

const SearchResultCard: React.FC<SearchResultCardProps> = React.memo(
	({ result, index, isSelected, onSelect, onOpen, renderSnippet }) => {
		const handleClick: React.MouseEventHandler<HTMLDivElement> = () => {
			onSelect(index);
			onOpen(index);
		};

		const handleFocus: React.FocusEventHandler<HTMLDivElement> = () => {
			onSelect(index);
		};

		const isNote = result.type === "note";
		const projectAlias = result.projectAlias || result.path.split("/")[1] || "unknown";

		const cardClasses = `relative p-5 bg-surface/85 border border-border rounded-xl transition-colors cursor-pointer outline-none ${
			isSelected
				? "border-accent ring-1 ring-accent/30 bg-surface"
				: "hover:bg-surface hover:border-glass-border/80"
		}`;

		return (
			<div
				data-result-item="true"
				tabIndex={0}
				className={cardClasses}
				onClick={handleClick}
				onFocus={handleFocus}
			>
				<div className="absolute -left-8 top-4 text-text-dim text-[11px] w-7 text-right">
					{index + 1}
				</div>

				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-3 text-xs">
						<span
							className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
								isNote ? "bg-yellow/20 text-yellow" : "bg-blue/20 text-blue"
							}`}
						>
							{isNote ? "Note" : "Document"}
						</span>
						<span className="text-purple font-semibold">{projectAlias}</span>
						<span className="text-text-dim">{result.updated}</span>
						{result.matchCount > 1 && (
							<span className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-[10px] font-semibold">
								{result.matchCount} {result.matchCount === 1 ? "match" : "matches"}
							</span>
						)}
					</div>
				</div>

				<div className="mb-3 font-medium text-text-bright">{result.title}</div>

				<div className="space-y-2">
					{result.snippets.map((snippet, snippetIdx) => (
						<div
							key={snippetIdx}
							className="text-sm [&_mark]:bg-yellow/20 [&_mark]:text-yellow [&_mark]:px-1 [&_mark]:rounded [&_mark]:font-semibold pl-3 border-l-2 border-border"
						>
							{renderSnippet(snippet)}
						</div>
					))}
				</div>
			</div>
		);
	},
);