import { Search } from "lucide-react";
import type React from "react";
import { Input } from "../shared/ui";
import { cn } from "../shared/utils/cn";

export interface SettingsNavItem {
	id: string;
	label: string;
}

interface SettingsNavProps {
	sections: SettingsNavItem[];
	activeId: string;
	onSelect: (id: string) => void;
	filter: string;
	onFilterChange: (value: string) => void;
	className?: string;
}

/**
 * Sticky in-page table of contents for the settings page. Surfaces the section
 * jump list (previously built but never rendered) and a type-to-filter box so
 * keyboard-first users can reach any of the nine sections without scrolling.
 */
export const SettingsNav: React.FC<SettingsNavProps> = ({
	sections,
	activeId,
	onSelect,
	filter,
	onFilterChange,
	className,
}) => {
	return (
		<aside className={cn("w-48 shrink-0", className)} aria-label="Settings sections">
			<div className="relative mb-3">
				<Search
					className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-dim"
					aria-hidden="true"
				/>
				<Input
					variant="default"
					value={filter}
					onChange={(e) => onFilterChange(e.target.value)}
					placeholder="Filter settings"
					aria-label="Filter settings"
					className="pl-8"
				/>
			</div>
			<nav className="flex flex-col gap-0.5">
				{sections.length === 0 ? (
					<p className="px-2.5 py-1.5 text-xs text-text-dim">No matching settings.</p>
				) : (
					sections.map((s) => (
						<button
							key={s.id}
							type="button"
							onClick={() => onSelect(s.id)}
							aria-current={s.id === activeId ? "true" : undefined}
							className={cn(
								"rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
								s.id === activeId
									? "bg-accent/12 text-accent font-medium"
									: "text-text-dim hover:bg-accent/8 hover:text-text",
							)}
						>
							{s.label}
						</button>
					))
				)}
			</nav>
		</aside>
	);
};
