import React from "react";

interface StatusBarProps {
  totalEntries: number;
  currentContext: string;
  showArchived?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalEntries,
  currentContext,
  showArchived,
}) => {
  const entriesLabel =
    totalEntries === 1 ? "1 entry" : `${totalEntries} entries`;

  return (
    <div className="bg-bg border-t border-border px-4 py-1.5 mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-text-dim font-sans">
      <div className="flex items-center gap-4 whitespace-nowrap">
        <span className="flex items-center gap-1">{entriesLabel}</span>
        {showArchived && (
          <span className="flex items-center gap-1 text-accent">
            [archived view]
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="text-text-dim">Context:</span>
        <span className="text-text">{currentContext}</span>
      </div>
    </div>
  );
};
