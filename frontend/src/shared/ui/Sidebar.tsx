import { ChevronDown, Command } from "lucide-react";
import type React from "react";
import { formatShortcutKeyForDisplay } from "@/config/shortcuts";
import { getMergedConfig } from "@/shared/stores/preferences.store";
import logoImage from "../../assets/images/logo-universal.png";
import { useCommandPaletteStore } from "../../command-palette/commandPalette.store";
import { useSidebarStateStore } from "../stores/sidebarState.store";
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
 * A single row in the expandable panel — a pinned/recent doc, a project, or a
 * filter. Carries an optional count badge, active state, and a hover-revealed
 * action (e.g. unpin).
 */
const PanelRow: React.FC<{ item: SidebarItem }> = ({ item }) => (
	<div className="group/row relative flex items-center">
		<button
			type="button"
			onClick={item.onClick}
			aria-current={item.active ? "true" : undefined}
			className={cn(
				"flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pl-2 text-left text-[13px] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
				// Reserve room for the absolute-positioned action button so it never
				// overlaps a truncated label.
				item.action ? "pr-8" : "pr-2",
				item.active ? "bg-accent/16 text-accent" : "text-text-dim hover:bg-accent/8 hover:text-text",
			)}
		>
			<span className="min-w-0 flex-1 truncate">{item.label}</span>
			{typeof item.count === "number" && (
				<span className="shrink-0 text-[11px] tabular-nums text-text-dim/70">{item.count}</span>
			)}
		</button>
		{item.action && (
			<button
				type="button"
				onClick={item.action.onClick}
				aria-label={item.action.label}
				title={item.action.label}
				className="absolute right-1 flex h-5 w-5 items-center justify-center rounded text-text-dim opacity-0 transition-opacity hover:bg-accent/10 hover:text-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent group-hover/row:opacity-100"
			>
				{item.action.icon}
			</button>
		)}
	</div>
);

/**
 * A collapsible section in the expandable panel. Collapse state is persisted in
 * the sidebar-state store so it survives navigation and restarts.
 */
const PanelSection: React.FC<{ section: SidebarSection }> = ({ section }) => {
	const collapsed = useSidebarStateStore((s) => s.collapsedSections.includes(section.id));
	const toggleSection = useSidebarStateStore((s) => s.toggleSection);
	const regionId = `sidebar-section-${section.id}`;

	if (section.items.length === 0) return null;

	return (
		<div className="px-2 py-1.5">
			<button
				type="button"
				onClick={() => toggleSection(section.id)}
				aria-expanded={!collapsed}
				aria-controls={regionId}
				className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim/60 transition-colors hover:text-text-dim focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
			>
				<ChevronDown
					className={cn(
						"h-3 w-3 shrink-0 transition-transform duration-[var(--duration-fast)]",
						collapsed && "-rotate-90",
					)}
					aria-hidden="true"
				/>
				<span>{section.title}</span>
			</button>
			{!collapsed && (
				<div id={regionId} className="mt-0.5 flex flex-col gap-px">
					{section.items.map((item) => (
						<PanelRow key={item.id} item={item} />
					))}
				</div>
			)}
		</div>
	);
};

/**
 * Expandable panel beside the rail. Renders the contextual sections (pinned,
 * recent, projects, filters, plugin, archive) built by useSidebarSections. The
 * rail stays the at-a-glance nav anchor; this panel surfaces the working set.
 */
const SidebarPanel: React.FC<{ sections: SidebarSection[] }> = ({ sections }) => {
	if (sections.length === 0) return null;

	return (
		<div
			aria-label="Sidebar sections"
			className="flex h-full w-52 flex-col overflow-y-auto border-l border-border py-2"
		>
			{sections.map((section) => (
				<PanelSection key={section.id} section={section} />
			))}
		</div>
	);
};

/**
 * The app sidebar: a slim icon rail (primary, keyboard-first navigation with the
 * command palette as the hero affordance) plus an expandable panel that surfaces
 * the contextual sections (pinned/recent/projects/filters/archive). The whole
 * sidebar is shown/hidden by Layout via the Ctrl+B toggle.
 */
export const Sidebar: React.FC<SidebarProps> = ({ sections, className }) => {
	const openPalette = useCommandPaletteStore((s) => s.open);
	const paletteShortcut = formatShortcutKeyForDisplay(
		getMergedConfig().shortcuts.global.commandPalette.key,
	);

	const nav = sections.find((s) => s.id === "navigation");
	const items = nav?.items ?? [];
	const topItems = items.filter((i) => i.id !== "settings");
	const bottomItems = items.filter((i) => i.id === "settings");
	const home = items.find((i) => i.id === "dashboard");
	const panelSections = sections.filter((s) => s.id !== "navigation");

	return (
		<div className={cn("flex h-full", className)}>
			<aside
				role="navigation"
				aria-label="Main navigation"
				className="flex h-full w-14 flex-col items-center py-3"
			>
				<button
					type="button"
					onClick={home?.onClick}
					aria-label="Yanta — documents"
					className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					<img src={logoImage} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
				</button>

				<Tooltip
					tooltipId="rail-command"
					content="Command palette"
					shortcut={paletteShortcut}
					placement="right"
				>
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

			<SidebarPanel sections={panelSections} />
		</div>
	);
};
