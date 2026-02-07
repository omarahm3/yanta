import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as searchModels from "../../bindings/yanta/internal/search/models";
import { Query } from "../../bindings/yanta/internal/search/service";
import type * as tagModels from "../../bindings/yanta/internal/tag/models";
import { ListActive as ListActiveTags } from "../../bindings/yanta/internal/tag/service";
import { TIMEOUTS } from "../config";
import { Layout } from "../components/Layout";
import { Button, Input } from "../components/ui";
import { useProjectContext } from "../contexts";
import { useHelp } from "../hooks";
import { useNotification } from "../hooks/useNotification";
import { useSidebarSections } from "../hooks/useSidebarSections";
import type { NavigationState } from "../types";
import { BackendLogger } from "../utils/backendLogger";

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
	onNavigate?: (page: string, state?: NavigationState) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const Search: React.FC<SearchProps> = ({ onNavigate, onRegisterToggleSidebar }) => {
	const [rawQuery, setRawQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [queryTime, setQueryTime] = useState<number>(0);

	const { error: notifyError } = useNotification();
	const { projects, setCurrentProject } = useProjectContext();
	const { setPageContext } = useHelp();

	const [availableTags, setAvailableTags] = useState<string[]>([]);

	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const searchTimeoutRef = useRef<number | null>(null);

	// Set page context for help modal
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

	const performSearch = useCallback(
		async (queryStr: string) => {
			if (!queryStr.trim()) {
				setResults([]);
				setSearchError(null);
				return;
			}

			setIsLoading(true);
			setSearchError(null);
			const startTime = performance.now();

			try {
				const searchResults = await Query(queryStr, 50, 0);
				const endTime = performance.now();
				setQueryTime(Math.round(endTime - startTime));

				if (searchResults && Array.isArray(searchResults)) {
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
				} else {
					setResults([]);
				}
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : "Search failed";
				setSearchError(errorMsg);
				notifyError(`Search error: ${errorMsg}`);
				setResults([]);
			} finally {
				setIsLoading(false);
			}
		},
		[notifyError],
	);

	useEffect(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		searchTimeoutRef.current = setTimeout(() => {
			performSearch(rawQuery);
		}, TIMEOUTS.searchDebounceMs);

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

	useEffect(() => {
		if (selectedIndex > groupedResults.length - 1) {
			setSelectedIndex(Math.max(0, groupedResults.length - 1));
		}
	}, [groupedResults.length, selectedIndex]);

	const openResult = useCallback(
		(index: number) => {
			const result = groupedResults[index];
			if (!result) return;

			// Set the project context
			const projectAlias = result.projectAlias || result.path.split("/")[1];
			const targetProject = projects.find((p) => p.alias === projectAlias);
			if (targetProject) {
				setCurrentProject(targetProject);
			} else {
				BackendLogger.warn(`Project with alias '${projectAlias}' not found in active projects`);
			}

			if (result.type === "note") {
				// Navigate to Journal page with the date and noteId
				// result.updated contains the date (YYYY-MM-DD)
				onNavigate?.("journal", { date: result.updated, noteId: result.noteId });
			} else {
				// Navigate to document page
				onNavigate?.("document", { documentPath: result.path });
			}
		},
		[groupedResults, onNavigate, projects, setCurrentProject],
	);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const focused = document.activeElement as HTMLElement | null;
			const isSearchInputFocused = focused === (searchInputRef.current as unknown as HTMLElement);

			if (e.key === "Tab" && isSearchInputFocused && !e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();

				if (groupedResults.length > 0) {
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
				if (groupedResults.length > 0) {
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
					const newIndex = Math.min(prev + 1, groupedResults.length - 1);
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
	}, [groupedResults.length, openResult, selectedIndex]);

	const sidebarSections = useSidebarSections({
		currentPage: "search",
		onNavigate,
	});

	const renderSnippet = (snippet: string) => {
		// biome-ignore lint/security/noDangerouslySetInnerHtml: search result HTML is trusted backend content with highlight marks
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
				{/* Search Header */}
				<div className="p-4 border-b bg-transparent border-glass-border shrink-0">
					<div className="flex items-center gap-3 mb-3">
						<span className="text-base text-accent">/</span>
						<Input
							ref={searchInputRef}
							variant="default"
							placeholder="Search entries... (try: project:alias, tag:name, title:text, -exclude, AND, OR)"
							value={rawQuery}
							onChange={(e) => setRawQuery((e.target as HTMLInputElement).value)}
							className="flex-1 text-base bg-glass-bg/20 backdrop-blur-sm border-glass-border"
						/>
					</div>

					{/* Filters */}
					<div className="flex items-center gap-3 text-xs flex-wrap">
						{/* Projects */}
						{projects.slice(0, 10).map((p) => (
							<Button
								key={p.alias}
								variant="ghost"
								size="sm"
								className="inline-flex items-center gap-1 border border-purple text-purple hover:bg-purple/10"
								onClick={() => addFilterToQuery("project", p.alias)}
							>
								{p.alias}
							</Button>
						))}

						<span className="px-1 text-text-dim">|</span>

						{/* Tags */}
						{availableTags.map((t) => (
							<Button
								key={t}
								variant="ghost"
								size="sm"
								className="inline-flex items-center gap-1 border border-green text-green hover:bg-green/10"
								onClick={() => addFilterToQuery("tag", t)}
							>
								#{t}
							</Button>
						))}
					</div>
				</div>

				{/* Search Info Bar */}
				<div className="flex items-center justify-between px-5 py-2 text-xs border-b bg-glass-bg/10 border-glass-border text-text-dim shrink-0">
					<div className="flex gap-4">
						{isLoading ? (
							<span className="text-yellow">Searching...</span>
						) : (
							<>
								<span>
									Found <span className="font-semibold text-text">{groupedResults.length}</span>{" "}
									{groupedResults.length === 1 ? "result" : "results"}
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
						<span className="font-mono text-accent">"phrase"</span>
						<span className="font-mono text-accent">AND OR</span>
					</div>
				</div>

				{/* Results */}
				<div className="p-5 flex-1 overflow-y-auto">
					{searchError ? (
						<div className="p-4 text-center bg-surface border border-red/30 rounded text-red">
							Error: {searchError}
						</div>
					) : groupedResults.length === 0 && !isLoading ? (
						<div className="p-8 text-center text-text-dim">
							{rawQuery.trim() ? (
								<>
									<div className="text-lg mb-2">No results found</div>
									<div className="text-sm">Try different keywords or remove some filters</div>
								</>
							) : (
								<>
									<div className="text-lg mb-2">Start searching</div>
									<div className="text-sm">Type a query or click filters to search your documents</div>
								</>
							)}
						</div>
					) : (
						<div className="space-y-5">
							{groupedResults.map((r, idx) => {
								return (
									<div
										key={r.path}
										data-result-item="true"
										tabIndex={0}
										className={`relative p-5 bg-glass-bg/20 backdrop-blur-md border border-glass-border rounded-xl transition-all cursor-pointer outline-none shadow-sm ${
											idx === selectedIndex
												? "border-accent ring-1 ring-accent/30 bg-glass-bg/30 shadow-md transform scale-[1.01]"
												: "hover:bg-glass-bg/30 hover:shadow-md hover:border-glass-border/80"
										}`}
										onClick={() => {
											setSelectedIndex(idx);
											openResult(idx);
										}}
										onMouseEnter={() => setSelectedIndex(idx)}
										onFocus={() => setSelectedIndex(idx)}
									>
										<div className="absolute -left-8 top-4 text-text-dim text-[11px] w-7 text-right">
											{idx + 1}
										</div>

										<div className="flex items-center justify-between mb-2">
											<div className="flex items-center gap-3 text-xs">
												<span
													className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
														r.type === "note" ? "bg-yellow/20 text-yellow" : "bg-blue/20 text-blue"
													}`}
												>
													{r.type === "note" ? "Note" : "Document"}
												</span>
												<span className="text-purple font-semibold">
													{r.projectAlias || r.path.split("/")[1] || "unknown"}
												</span>
												<span className="text-text-dim">{r.updated}</span>
												{r.matchCount > 1 && (
													<span className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-[10px] font-semibold">
														{r.matchCount} {r.matchCount === 1 ? "match" : "matches"}
													</span>
												)}
											</div>
										</div>

										<div className="mb-3 font-medium text-text-bright">{r.title}</div>

										<div className="space-y-2">
											{r.snippets.map((snippet, snippetIdx) => (
												<div
													// biome-ignore lint/suspicious/noArrayIndexKey: snippets are unique within a result
													key={snippetIdx}
													className="text-sm [&_mark]:bg-yellow/20 [&_mark]:text-yellow [&_mark]:px-1 [&_mark]:rounded [&_mark]:font-semibold pl-3 border-l-2 border-border"
												>
													{renderSnippet(snippet)}
												</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</Layout>
	);
};
