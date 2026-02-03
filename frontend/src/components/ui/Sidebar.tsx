import type React from "react";
import logoImage from "../../assets/images/logo-universal.png";
import { cn } from "../../lib/utils";
import { List, ListItem } from "./List";
import { WithTooltip } from "./WithTooltip";

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
		<aside className={cn("h-full w-48 bg-surface border-r border-border p-5 overflow-y-auto", className)}>
			<div className="mb-8 flex items-center justify-center">
				<img src={logoImage} alt="YANTA" className="h-12 w-auto object-contain" />
			</div>
			{sections.map((section) => (
				<div key={section.id} className="mb-8">
					<div className="text-text-dim text-xs uppercase tracking-wider mb-2">{section.title}</div>
					<List variant="sidebar">
						{section.items.map((item) => {
							const listItemContent = (
								<ListItem
									key={item.id}
									variant="sidebar"
									active={item.active}
									onClick={item.onClick}
									className="flex items-center justify-between"
								>
									<span>{item.label}</span>
									{item.count !== undefined && <span className="text-xs opacity-70">{item.count}</span>}
								</ListItem>
							);

							// Wrap with tooltip if tooltip info is provided
							if (item.tooltip) {
								return (
									<WithTooltip
										key={item.id}
										tooltipId={item.tooltip.tooltipId}
										description={item.tooltip.description}
										shortcut={item.tooltip.shortcut}
										placement="right"
									>
										{listItemContent}
									</WithTooltip>
								);
							}

							return listItemContent;
						})}
					</List>
				</div>
			))}
		</aside>
	);
};
