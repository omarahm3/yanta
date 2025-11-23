import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as searchModels from "../../bindings/yanta/internal/search/models";
import { Query } from "../../bindings/yanta/internal/search/service";
import type * as tagModels from "../../bindings/yanta/internal/tag/models";
import { ListActive as ListActiveTags } from "../../bindings/yanta/internal/tag/service";
import { Layout } from "../components/Layout";
import { Button, Input } from "../components/ui";
import { useProjectContext } from "../contexts";
import { useNotification } from "../hooks/useNotification";
import { useSidebarSections } from "../hooks/useSidebarSections";

interface SearchResult {
	path: string;
	title: string;
	snippet: string;
	updated: string;
}

interface GroupedSearchResult {
	path: string;
	title: string;
	snippets: string[];
	updated: string;
	matchCount: number;
}

interface SearchProps {
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
}

export const Search: React.FC<SearchProps> = ({ onNavigate }) => {
	const [rawQuery, setRawQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [queryTime, setQueryTime] = useState<number>(0);

	const { error: notifyError } = useNotification();
	const { projects, setCurrentProject } = useProjectContext();

	const [availableTags, setAvailableTags] = useState<string[]>([]);

	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const searchTimeoutRef = useRef<number | null>(null);

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
				console.error("Failed to load tags:", err);
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
		}, 300);

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, [rawQuery, performSearch]);

	const groupedResults = useMemo(() => {
		const groups = new Map<string, GroupedSearchResult>();

		results.forEach((result) => {
			if (groups.has(result.path)) {
				const existing = groups.get(result.path)!;
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

			const pathParts = result.path.split("/");
			const projectAlias = pathParts[1];

			const targetProject = projects.find((p) => p.alias === projectAlias);
			if (targetProject) {
				setCurrentProject(targetProject);
			} else {
				console.warn(`Project with alias '${projectAlias}' not found in active projects`);
			}

			onNavigate?.("document", { documentPath: result.path });
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
			showCommandLine={false}
		>
			<div className="flex flex-col h-full">
				{/* Search Header */}
				<div className="p-4 border-b bg-surface border-border shrink-0">
					<div className="flex items-center gap-3 mb-3">
						<span className="text-base text-accent">/</span>
						<Input
							ref={searchInputRef}
							variant="default"
							placeholder="Search entries... (try: project:alias, tag:name, title:text, -exclude, AND, OR)"
							value={rawQuery}
							onChange={(e) => setRawQuery((e.target as HTMLInputElement).value)}
							className="flex-1 text-base"
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
				<div className="flex items-center justify-between px-5 py-2 text-xs border-b bg-bg border-border text-text-dim shrink-0">
					<div className="flex gap-4">
						{isLoading ? (
							<span className="text-yellow">Searching...</span>
						) : (
							<>
								<span>
									Found <span className="font-semibold text-text">{groupedResults.length}</span>{" "}
									{groupedResults.length === 1 ? "document" : "documents"}
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
										className={`relative p-4 bg-surface border border-border rounded transition cursor-pointer outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 ${
											idx === selectedIndex ? "border-accent ring-1 ring-accent/30" : "hover:border-accent/50"
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
												<span className="text-purple font-semibold">{r.path.split("/")[1] || "unknown"}</span>
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
