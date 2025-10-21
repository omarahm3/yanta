import React from "react";
import { cn } from "../../lib/utils";
import { List, ListItem } from "./List";

export interface SidebarSection {
  id: string;
  title: string;
  items: SidebarItem[];
}

export interface SidebarItem {
  id: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarProps {
  title?: string;
  sections: SidebarSection[];
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  title,
  sections,
  className,
}) => {
  return (
    <aside
      className={cn(
        "w-48 bg-surface border-r border-border p-5 overflow-y-auto",
        className
      )}
    >
      {title && (
        <div className="text-text-bright text-base font-semibold mb-8">
          {title}
        </div>
      )}

      {sections.map((section) => (
        <div key={section.id} className="mb-8">
          <div className="text-text-dim text-xs uppercase tracking-wider mb-2">
            {section.title}
          </div>
          <List variant="sidebar">
            {section.items.map((item) => (
              <ListItem
                key={item.id}
                variant="sidebar"
                active={item.active}
                onClick={item.onClick}
                className="flex items-center justify-between"
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs opacity-70">{item.count}</span>
                )}
              </ListItem>
            ))}
          </List>
        </div>
      ))}
    </aside>
  );
};
