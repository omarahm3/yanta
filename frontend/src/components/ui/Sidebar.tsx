import type React from "react";
import logoImage from "../../assets/images/logo-universal.png";
import { cn } from "../../lib/utils";
import { List, ListItem } from "./List";
import { Tooltip } from "./Tooltip";

export interface SidebarSection {
	id: string;
	title: string;
	items: SidebarItem[];
}

export interface SidebarItemTooltip {
	/** Unique identifier for tracking tooltip usage */
	tooltipId: string;
	/** Description text to display in the tooltip */
	description: string;
	/** Optional keyboard shortcut to display (e.g., "Ctrl+J", "Ctrl+Shift+F") */
	shortcut?: string;
}

export interface SidebarItem {
	id: string;
	label: string;
	count?: number;
	active?: boolean;
	onClick?: () => void;
	/** Optional tooltip configuration for this item */
	tooltip?: SidebarItemTooltip;
}

export interface SidebarProps {
	sections: SidebarSection[];
	className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ sections, className }) => {
	return (
		<aside className={cn("h-full w-48 p-4 overflow-y-auto flex flex-col", className)}>
			<div className="mb-8 flex items-center px-2">
				<img src={logoImage} alt="YANTA" className="h-10 w-auto object-contain opacity-90" />
			</div>

			<div className="flex-1 space-y-6">
				{sections.map((section) => (
					<div key={section.id}>
						<div className="px-2 text-xs font-semibold uppercase tracking-wider text-text-dim mb-3 opacity-80">
							{section.title}
						</div>
						<List variant="sidebar" className="space-y-0.5">
							{section.items.map((item) => {
								const listItemContent = (
									<ListItem
										key={item.id}
										variant="sidebar"
										active={item.active}
										onClick={item.onClick}
										className={cn("sidebar-item", item.active && "active")}
									>
										<span className="font-medium">{item.label}</span>
										{item.count !== undefined && (
											<span className="text-xs bg-bg-dark/30 px-1.5 py-0.5 rounded text-text-dim">
												{item.count}
											</span>
										)}
									</ListItem>
								);

								if (item.tooltip) {
									return (
										<Tooltip
											key={item.id}
											tooltipId={item.tooltip.tooltipId}
											content={item.tooltip.description}
											shortcut={item.tooltip.shortcut}
											placement="right"
										>
											{listItemContent}
										</Tooltip>
									);
								}

								return listItemContent;
							})}
						</List>
					</div>
				))}
			</div>
		</aside>
	);
};
