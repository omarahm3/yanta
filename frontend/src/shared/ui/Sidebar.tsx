import { Command } from "lucide-react";
import type React from "react";
import logoImage from "../../assets/images/logo-universal.png";
import { useCommandPaletteStore } from "../../command-palette/commandPalette.store";
import { cn } from "../utils/cn";
import { Tooltip } from "./Tooltip";

export interface SidebarSection {
	id: string;
	title: string;
	items: SidebarItem[];
}

export interface SidebarItemTooltip {
	tooltipId: string;
	description: string;
	shortcut?: string;
}

export interface SidebarItem {
	id: string;
	label: string;
	/** Optional icon node (rendered in the icon rail). Falls back to the first letter. */
	icon?: React.ReactNode;
	count?: number;
	active?: boolean;
	onClick?: () => void;
	tooltip?: SidebarItemTooltip;
	action?: {
		label: string;
		icon: string;
		onClick: (e: React.MouseEvent) => void;
	};
}

export interface SidebarProps {
	sections: SidebarSection[];
	className?: string;
}

const cap = (s: string): string => (s.length ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * A single destination in the icon rail. Active state is carried by a teal-tint
 * fill + accent icon (no side-stripe). The label and shortcut live in a tooltip,
 * keeping the rail slim and the app keyboard-first — the command palette is the
 * primary way to navigate; the rail is the at-a-glance anchor.
 */
const RailButton: React.FC<{ item: SidebarItem }> = ({ item }) => {
	const content = item.tooltip?.description ?? cap(item.label);
	const shortcut = item.tooltip?.shortcut;

	return (
		<Tooltip tooltipId={`rail-${item.id}`} content={content} shortcut={shortcut} placement="right">
			<button
				type="button"
				onClick={item.onClick}
				aria-current={item.active ? "page" : undefined}
				aria-label={content}
				className={cn(
					"flex h-10 w-10 items-center justify-center rounded-lg transition-[color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-quint)] active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
					item.active ? "bg-accent/16 text-accent" : "text-text-dim hover:bg-accent/8 hover:text-text",
				)}
			>
				{item.icon ?? (
					<span className="text-sm font-semibold uppercase">{cap(item.label[0] ?? "?")}</span>
				)}
			</button>
		</Tooltip>
	);
};

/**
 * Icon rail — the app's primary navigation anchor. Renders the destinations from
 * the "navigation" section as a slim, keyboard-first strip with the command
 * palette ('⌘K') as the hero affordance. Contextual lists (projects, recents)
 * are reached through the palette and their dedicated pages.
 */
export const Sidebar: React.FC<SidebarProps> = ({ sections, className }) => {
	const openPalette = useCommandPaletteStore((s) => s.open);

	const nav = sections.find((s) => s.id === "navigation");
	const items = nav?.items ?? [];
	const topItems = items.filter((i) => i.id !== "settings");
	const bottomItems = items.filter((i) => i.id === "settings");
	const home = items.find((i) => i.id === "dashboard");

	return (
		<aside
			role="navigation"
			aria-label="Main navigation"
			className={cn("flex h-full w-14 flex-col items-center py-3", className)}
		>
			<button
				type="button"
				onClick={home?.onClick}
				aria-label="Yanta — documents"
				className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				<img src={logoImage} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
			</button>

			<Tooltip tooltipId="rail-command" content="Command palette" shortcut="Ctrl+K" placement="right">
				<button
					type="button"
					onClick={openPalette}
					aria-label="Open command palette"
					className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-dark text-text-dim transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quint)] hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					<Command className="h-4 w-4" aria-hidden="true" />
				</button>
			</Tooltip>

			<div className="h-px w-7 bg-border" aria-hidden="true" />

			<nav aria-label="Destinations" className="mt-3 flex flex-1 flex-col items-center gap-1">
				{topItems.map((item) => (
					<RailButton key={item.id} item={item} />
				))}
			</nav>

			{bottomItems.length > 0 && (
				<div className="mt-auto flex flex-col items-center gap-1 pt-3">
					{bottomItems.map((item) => (
						<RailButton key={item.id} item={item} />
					))}
				</div>
			)}
		</aside>
	);
};
