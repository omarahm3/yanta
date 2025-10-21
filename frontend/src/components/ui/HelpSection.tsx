import React from "react";
import { cn } from "../../lib/utils";

export interface HelpCommand {
  command: string;
  description: string;
}

export interface HelpSectionProps {
  title: string;
  commands: HelpCommand[];
  className?: string;
}

export const HelpSection: React.FC<HelpSectionProps> = ({
  title,
  commands,
  className,
}) => {
  return (
    <div
      className={cn(
        "mt-8 p-5 bg-surface border border-border rounded max-w-4xl",
        className
      )}
    >
      <div className="text-text-bright font-semibold mb-3">{title}</div>
      <div className="grid grid-cols-[200px_auto] gap-2 text-sm">
        {commands.map((cmd, index) => (
          <React.Fragment key={index}>
            <div className="text-accent font-mono">{cmd.command}</div>
            <div className="text-text-dim">{cmd.description}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
