import React from "react";
import { cn } from "../../lib/utils";

export interface HeaderBarProps {
  breadcrumb: string;
  currentPage: string;
  shortcuts?: Array<{
    key: string;
    label: string;
  }>;
  className?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  breadcrumb,
  currentPage,
  shortcuts = [],
  className,
}) => {
  return (
    <div
      className={cn(
        "bg-surface border-b border-border px-5 py-3 flex items-center justify-between",
        className
      )}
    >
      <div className="text-text-dim text-sm">
        {breadcrumb} /{" "}
        <span className="text-text-bright font-semibold">{currentPage}</span>
      </div>
      <div className="flex gap-4 text-xs text-text-dim">
        {shortcuts.map((shortcut, index) => (
          <span key={index} className="flex items-center gap-1">
            <kbd className="bg-bg px-1.5 py-0.5 rounded text-xs border border-border">
              {shortcut.key}
            </kbd>
            {shortcut.label}
          </span>
        ))}
      </div>
    </div>
  );
};
