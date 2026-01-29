import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import type { RegisteredHotkey } from "../../types/hotkeys";

export interface ShortcutSearchProps {
	shortcuts: RegisteredHotkey[];
	onFilteredResults: (results: RegisteredHotkey[]) => void;
	placeholder?: string;
	className?: string;
}

export const ShortcutSearch: React.FC<ShortcutSearchProps> = ({
	shortcuts,
	onFilteredResults,
	placeholder = "Search shortcuts...",
	className,
}) => {
	const [query, setQuery] = useState("");

	// Configure fuse.js for fuzzy searching
	const fuse = useMemo(() => {
		return new Fuse(shortcuts, {
			keys: [
				{ name: "key", weight: 2 },
				{ name: "description", weight: 1.5 },
				{ name: "category", weight: 1 },
			],
			threshold: 0.4,
			includeScore: true,
			ignoreLocation: true,
			minMatchCharLength: 1,
		});
	}, [shortcuts]);

	// Filter shortcuts based on query
	useEffect(() => {
		if (!query.trim()) {
			onFilteredResults(shortcuts);
			return;
		}

		const results = fuse.search(query).map((result) => result.item);
		onFilteredResults(results);
	}, [query, fuse, onFilteredResults, shortcuts]);

	// Handle ESC key to clear search
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && query) {
				e.preventDefault();
				e.stopPropagation();
				setQuery("");
			}
		};

		document.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [query]);

	const handleClear = () => {
		setQuery("");
	};

	return (
		<div className={cn("relative", className)}>
			<div className="relative flex items-center">
				<Search className="absolute left-3 w-4 h-4 text-text-dim pointer-events-none" />
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={placeholder}
					className="w-full pl-10 pr-10 py-2.5 bg-bg border border-border/40 rounded-md text-text placeholder:text-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all font-mono text-sm"
					autoComplete="off"
					spellCheck="false"
				/>
				{query && (
					<button
						type="button"
						onClick={handleClear}
						className="absolute right-3 w-4 h-4 text-text-dim hover:text-text transition-colors"
						aria-label="Clear search"
					>
						<X className="w-4 h-4" />
					</button>
				)}
			</div>
			{query && (
				<div className="mt-2 text-xs text-text-dim font-mono">
					Press <span className="text-accent font-semibold">ESC</span> to clear search
				</div>
			)}
		</div>
	);
};
