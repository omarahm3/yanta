import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronRight } from "lucide-react";
// Value import required at runtime (React.FC in bundle; type-only yields "React is not defined")
// biome-ignore lint: React used for React.FC and ref casts at runtime
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Heading } from "../../components/ui/Heading";
import { useHelpModalController } from "../hooks/useHelpModalController";

/**
 * Collapsible section component
 */
interface HelpSectionProps {
	title: string;
	isExpanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
	sectionId: string;
	shortcutCount: number;
}

const HelpSection: React.FC<HelpSectionProps> = ({
	title,
	isExpanded,
	onToggle,
	children,
	sectionId,
	shortcutCount,
}) => {
	const headerId = `help-section-header-${sectionId}`;
	const contentId = `help-section-content-${sectionId}`;

	return (
		<div className="border-b border-glass-border/30 last:border-b-0" role="group">
			<button
				type="button"
				id={headerId}
				onClick={onToggle}
				className="w-full flex items-center gap-2 py-3 px-4 text-left select-none cursor-pointer hover:bg-glass-bg/20 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-inset"
				aria-expanded={isExpanded}
				aria-controls={contentId}
				aria-label={`${title}, ${shortcutCount} shortcuts, ${isExpanded ? "expanded" : "collapsed"}. Press Enter or Space to ${isExpanded ? "collapse" : "expand"}.`}
			>
				<ChevronRight
					className={`w-4 h-4 text-text-dim transition-transform duration-150 ease-out ${
						isExpanded ? "rotate-90" : ""
					}`}
					aria-hidden="true"
				/>
				<span className="font-medium text-text-bright text-sm">{title}</span>
				<span className="text-text-dim text-xs ml-auto" aria-hidden="true">
					{shortcutCount}
				</span>
			</button>
			<div
				id={contentId}
				role="region"
				aria-labelledby={headerId}
				aria-hidden={!isExpanded}
				className={`overflow-hidden transition-all duration-150 ease-out ${
					isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
				}`}
			>
				<div className="px-4 pb-3 pl-10">{children}</div>
			</div>
		</div>
	);
};

/**
 * Shortcut row component
 */
interface ShortcutRowProps {
	shortcutKey: string;
	description: string;
	variant?: "accent" | "green" | "purple";
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({
	shortcutKey,
	description,
	variant = "purple",
}) => {
	const keyColorClasses = {
		accent: "text-accent",
		green: "text-green",
		purple: "text-text-dim",
	};

	return (
		<div className="flex items-center gap-4 py-1.5">
			<code className={`font-mono text-xs min-w-[120px] ${keyColorClasses[variant]}`}>
				{shortcutKey}
			</code>
			<span className="text-text text-[13px]">{description}</span>
		</div>
	);
};

/**
 * Main HelpModal component
 */
export const HelpModal: React.FC = () => {
	const {
		isOpen,
		closeHelp,
		pageName,
		searchQuery,
		setSearchQuery,
		expandedSections,
		toggleSection,
		announcement,
		searchInputRef,
		closeButtonRef,
		filteredSections,
		filteredGlobalCommands,
		filteredPageCommands,
		hasSearchQuery,
		totalResults,
		handleOpenChange,
		handleClearSearch,
	} = useHelpModalController();

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-[480px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-hidden bg-glass-bg/90 backdrop-blur-xl border border-glass-border rounded-[12px] p-0"
				style={{
					boxShadow: "0 16px 48px rgba(0, 0, 0, 0.4)",
				}}
				showCloseButton={false}
				aria-label="Keyboard shortcuts help modal"
				aria-describedby="help-modal-description"
			>
				<VisuallyHidden>
					<div role="status" aria-live="polite" aria-atomic="true">
						{announcement}
					</div>
					<p id="help-modal-description">
						Press Tab to navigate between elements. Press Enter or Space on section headers to expand or
						collapse. Press Escape to close.
					</p>
				</VisuallyHidden>

				<DialogHeader className="flex flex-row items-center justify-between px-4 py-4 border-b border-glass-border">
					<DialogTitle className="text-base font-semibold text-text">Keyboard Shortcuts</DialogTitle>
					<button
						ref={closeButtonRef as React.RefObject<HTMLButtonElement>}
						type="button"
						onClick={closeHelp}
						className="text-text-dim hover:text-text transition-colors text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 rounded px-1"
						aria-label="Close dialog (Escape)"
					>
						ESC
					</button>
				</DialogHeader>

				<div className="px-4 pt-4 pb-2">
					<div className="relative">
						<label htmlFor="help-search-input" className="sr-only">
							Search shortcuts
						</label>
						<input
							id="help-search-input"
							ref={searchInputRef as React.RefObject<HTMLInputElement>}
							type="search"
							placeholder="Search shortcuts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full px-3 py-2 bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md text-text placeholder-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all text-sm"
							aria-describedby="help-search-results"
							autoComplete="off"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={handleClearSearch}
								className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-text-dim hover:text-text transition-colors rounded hover:bg-bg-dim focus:outline-none focus:ring-2 focus:ring-accent/50"
								aria-label="Clear search"
							>
								Clear
							</button>
						)}
					</div>
					{hasSearchQuery && (
						<div
							id="help-search-results"
							className="mt-2 text-xs text-text-dim"
							role="status"
							aria-live="polite"
						>
							{totalResults === 0 ? (
								<span className="text-red">No shortcuts found for "{searchQuery}"</span>
							) : (
								<span>
									Showing results for "{searchQuery}" (
									<span className="text-accent font-semibold">{totalResults}</span> found)
								</span>
							)}
						</div>
					)}
				</div>

				<div className="overflow-y-auto max-h-[calc(70vh-140px)]" role="document">
					{filteredGlobalCommands.length > 0 && (
						<section
							className="px-4 py-3 border-b border-glass-border/30"
							aria-labelledby="global-commands-heading"
						>
							<Heading
								as="h3"
								id="global-commands-heading"
								variant="dim"
								size="sm"
								weight="bold"
								className="mb-3 tracking-wider uppercase text-xs"
							>
								COMMANDS
							</Heading>
							<ul className="space-y-1" aria-label="Global commands">
								{filteredGlobalCommands.map((cmd) => (
									<li key={cmd.command}>
										<ShortcutRow
											shortcutKey={`:${cmd.command}`}
											description={cmd.description}
											variant="green"
										/>
									</li>
								))}
							</ul>
						</section>
					)}

					{filteredPageCommands.length > 0 && (
						<section
							className="px-4 py-3 border-b border-glass-border/30"
							aria-labelledby="page-commands-heading"
						>
							<Heading
								as="h3"
								id="page-commands-heading"
								variant="dim"
								size="sm"
								weight="bold"
								className="mb-3 tracking-wider uppercase text-xs"
							>
								{pageName} COMMANDS
							</Heading>
							<ul className="space-y-1" aria-label={`${pageName} commands`}>
								{filteredPageCommands.map((cmd) => (
									<li key={cmd.command}>
										<ShortcutRow shortcutKey={cmd.command} description={cmd.description} variant="accent" />
									</li>
								))}
							</ul>
						</section>
					)}

					{filteredSections.length > 0 && (
						<div role="group" aria-label="Keyboard shortcut categories">
							{filteredSections.map((section) => (
								<HelpSection
									key={section.id}
									sectionId={section.id}
									title={section.title}
									isExpanded={expandedSections.has(section.id)}
									onToggle={() => toggleSection(section.id, section.title)}
									shortcutCount={section.shortcuts.length}
								>
									<ul className="space-y-1" aria-label={`${section.title} shortcuts`}>
										{section.shortcuts.map((shortcut) => (
											<li key={`${section.id}-${shortcut.key}`}>
												<ShortcutRow
													shortcutKey={shortcut.key}
													description={shortcut.description}
													variant="purple"
												/>
											</li>
										))}
									</ul>
								</HelpSection>
							))}
						</div>
					)}

					{totalResults === 0 && (
						<div className="py-12 px-6 text-center">
							<div className="space-y-4">
								<div className="text-4xl">🔍</div>
								<div className="text-sm font-medium text-text">No shortcuts found for "{searchQuery}"</div>
								<div className="text-xs text-text-dim">Try a different search term</div>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
