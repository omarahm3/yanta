import type React from "react";
import { useEffect, useRef, useState } from "react";
import { GLOBAL_COMMANDS } from "../../constants/globalCommands";
import { useHotkeyContext } from "../../contexts/HotkeyContext";
import { useHelp } from "../../hooks/useHelp";
import { Heading } from "../ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

const formatHotkeyDisplay = (key: string): string => {
	return key
		.replace(/mod/gi, "Ctrl")
		.replace(/shift/gi, "Shift")
		.replace(/alt/gi, "Alt")
		.replace(/meta/gi, "Meta")
		.replace(/\+/g, "+")
		.split("+")
		.map((part) => {
			const keyMap: Record<string, string> = {
				Escape: "ESC",
				" ": "SPACE",
				Enter: "ENTER",
				Tab: "TAB",
				ArrowUp: "↑",
				ArrowDown: "↓",
				ArrowLeft: "←",
				ArrowRight: "→",
			};
			return keyMap[part] || part.toUpperCase();
		})
		.join("+");
};

export const HelpModal: React.FC = () => {
	const { isOpen, closeHelp, pageCommands, pageName } = useHelp();
	const { getRegisteredHotkeys } = useHotkeyContext();
	const [searchQuery, setSearchQuery] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Auto-focus search input when modal opens
	useEffect(() => {
		if (isOpen && searchInputRef.current) {
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 100);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Handle ? to toggle/close
			if (e.key === "?") {
				e.preventDefault();
				closeHelp();
			}
			// Handle ESC to clear search first, then close
			else if (e.key === "Escape") {
				if (searchQuery.trim()) {
					e.preventDefault();
					e.stopPropagation();
					setSearchQuery("");
					searchInputRef.current?.focus();
				}
				// If search is empty, let ESC close the modal (default behavior)
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, closeHelp, searchQuery]);

	// Reset search when modal closes
	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
		}
	}, [isOpen]);

	const allHotkeys =
		pageName === "SETTINGS"
			? []
			: getRegisteredHotkeys().filter((h) => h.description && h.description !== "Toggle help");

	// Filter function
	const matchesSearch = (text: string) => {
		if (!searchQuery.trim()) return true;
		return text.toLowerCase().includes(searchQuery.toLowerCase());
	};

	// Filter all sections
	const filteredGlobalCommands = GLOBAL_COMMANDS.filter(
		(cmd) => matchesSearch(cmd.command) || matchesSearch(cmd.description),
	);

	const filteredPageCommands = pageCommands.filter(
		(cmd) => matchesSearch(cmd.command) || matchesSearch(cmd.description),
	);

	const filteredHotkeys = allHotkeys.filter(
		(h) => matchesSearch(h.key) || matchesSearch(h.description || ""),
	);

	// Group hotkeys by category
	const groupedHotkeys = filteredHotkeys.reduce(
		(acc, hotkey) => {
			const category = hotkey.category || "General";
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push(hotkey);
			return acc;
		},
		{} as Record<string, typeof filteredHotkeys>,
	);

	// Sort categories and hotkeys within each category
	const sortedCategories = Object.keys(groupedHotkeys).sort();
	sortedCategories.forEach((category) => {
		groupedHotkeys[category].sort((a, b) => (a.description ?? "").localeCompare(b.description ?? ""));
	});

	// Calculate total result count
	const totalResults =
		filteredGlobalCommands.length + filteredPageCommands.length + filteredHotkeys.length;
	const hasSearchQuery = searchQuery.trim().length > 0;

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			closeHelp();
		}
	};

	const handleClearSearch = () => {
		setSearchQuery("");
		searchInputRef.current?.focus();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-surface border-2 border-accent/30 p-0"
				style={{
					boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(88, 166, 255, 0.2)",
				}}
				showCloseButton={false}
			>
				<DialogHeader className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-border/40">
					<DialogTitle className="text-lg sm:text-xl font-bold tracking-wide text-accent">
						HELP
					</DialogTitle>
					<div className="text-xs text-text-dim font-mono hidden sm:block">
						Press <span className="text-accent font-semibold">ESC</span> or{" "}
						<span className="text-accent font-semibold">?</span> to close
					</div>
				</DialogHeader>

				{/* Search input */}
				<div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
					<div className="relative">
						<input
							ref={searchInputRef}
							type="text"
							placeholder="Search commands and shortcuts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full px-3 sm:px-4 py-2 sm:py-2.5 pr-20 bg-bg border border-border/40 rounded-md text-text placeholder-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all text-sm sm:text-base"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={handleClearSearch}
								className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-text-dim hover:text-text transition-colors rounded hover:bg-bg-dim"
								aria-label="Clear search"
							>
								Clear
							</button>
						)}
					</div>
					{hasSearchQuery && (
						<div className="mt-2 text-xs text-text-dim font-mono">
							{totalResults === 0 ? (
								<span className="text-red">No results found</span>
							) : (
								<span>
									Found <span className="text-accent font-semibold">{totalResults}</span> result
									{totalResults !== 1 ? "s" : ""}
								</span>
							)}
						</div>
					)}
				</div>

				<div className="p-4 sm:p-6 pt-2 overflow-y-auto max-h-[calc(85vh-160px)] text-left">
					<div className="space-y-6 sm:space-y-8">
						{filteredGlobalCommands.length > 0 && (
							<div>
								<Heading
									as="h3"
									variant="dim"
									size="sm"
									weight="bold"
									className="mb-3 sm:mb-4 tracking-wider uppercase"
								>
									GLOBAL COMMANDS
								</Heading>
								<div className="grid gap-2">
									{filteredGlobalCommands.map((cmd) => (
										<div
											key={cmd.command}
											className="grid grid-cols-[minmax(160px,auto)_1fr] items-baseline gap-3 sm:gap-4 font-mono text-sm group py-1.5 px-2 -mx-2 rounded hover:bg-bg/50 transition-colors"
										>
											<code className="px-2 py-1 bg-bg border border-green/20 rounded text-green font-medium transition-all duration-200 group-hover:border-green/40 group-hover:bg-green/5 text-xs sm:text-sm w-fit">
												:{cmd.command}
											</code>
											<span className="text-text text-xs sm:text-sm">{cmd.description}</span>
										</div>
									))}
								</div>
							</div>
						)}

						{filteredPageCommands.length > 0 && (
							<div>
								<Heading
									as="h3"
									variant="dim"
									size="sm"
									weight="bold"
									className="mb-3 sm:mb-4 tracking-wider uppercase"
								>
									{pageName} COMMANDS
								</Heading>
								<div className="grid gap-2">
									{filteredPageCommands.map((cmd) => (
										<div
											key={cmd.command}
											className="grid grid-cols-[minmax(160px,auto)_1fr] items-baseline gap-3 sm:gap-4 font-mono text-sm group py-1.5 px-2 -mx-2 rounded hover:bg-bg/50 transition-colors"
										>
											<code className="px-2 py-1 bg-bg border border-accent/20 rounded text-accent font-medium transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 text-xs sm:text-sm w-fit">
												{cmd.command}
											</code>
											<span className="text-text text-xs sm:text-sm">{cmd.description}</span>
										</div>
									))}
								</div>
							</div>
						)}

						{sortedCategories.length > 0 && (
							<div>
								<Heading
									as="h3"
									variant="dim"
									size="sm"
									weight="bold"
									className="mb-3 sm:mb-4 tracking-wider uppercase"
								>
									KEYBOARD SHORTCUTS
								</Heading>
								<div className="space-y-5 sm:space-y-6">
									{sortedCategories.map((category) => (
										<div key={category}>
											<div className="text-xs font-semibold text-text-dim tracking-wider uppercase mb-2 sm:mb-3 pl-2">
												{category}
											</div>
											<div className="grid gap-2">
												{groupedHotkeys[category].map((hotkey) => (
													<div
														key={hotkey.id}
														className="grid grid-cols-[minmax(140px,auto)_1fr] items-baseline gap-3 sm:gap-4 font-mono text-sm group py-1.5 px-2 -mx-2 rounded hover:bg-bg/50 transition-colors"
													>
														<code className="px-2 py-1 bg-bg border border-purple/20 rounded text-purple font-medium transition-all duration-200 group-hover:border-purple/40 group-hover:bg-purple/5 text-xs sm:text-sm w-fit">
															{formatHotkeyDisplay(hotkey.key)}
														</code>
														<span className="text-text text-xs sm:text-sm">{hotkey.description}</span>
													</div>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{filteredGlobalCommands.length === 0 &&
						filteredPageCommands.length === 0 &&
						sortedCategories.length === 0 && (
							<div className="py-12 px-6 text-center">
								{searchQuery.trim() ? (
									<div className="space-y-4">
										<div className="text-6xl">🔍</div>
										<div className="text-lg font-semibold text-text">No results found</div>
										<div className="text-text-dim">
											Try a different search term or clear the search to see all commands.
										</div>
									</div>
								) : pageName === "SETTINGS" ? (
									<div className="space-y-4">
										<div className="text-6xl">🤔</div>
										<div className="text-lg font-semibold text-text">Looking for keyboard shortcuts?</div>
										<div className="text-text-dim">They're literally right there on the page! ↓</div>
										<div className="text-sm text-text-dim/70 italic">(Scroll up if you can't see them)</div>
									</div>
								) : (
									<div className="text-text-dim">No page-specific commands or shortcuts available.</div>
								)}
							</div>
						)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
