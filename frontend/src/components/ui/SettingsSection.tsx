import React from "react";
import { cn } from "../../lib/utils";

export interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  subtitle,
  children,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded p-5 mb-5",
        className
      )}
    >
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-border">
        <div>
          <div className="text-text-bright text-base font-semibold">
            {title}
          </div>
          {subtitle && (
            <div className="text-text-dim text-xs mt-1">{subtitle}</div>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>
      {children}
    </div>
  );
};
