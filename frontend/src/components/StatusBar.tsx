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
  return (
    <div className="bg-bg border-t border-border px-4 py-1.5 flex justify-between items-center text-xs text-text-dim font-sans">
      <div className="flex gap-4">
        <span className="flex items-center gap-1">{totalEntries} entries</span>
        {/* <span className="flex items-center gap-1">🔥 {streak} day streak</span> */}
        <span className="flex items-center gap-1">
          {currentContext} context
        </span>
        {showArchived && (
          <span className="flex items-center gap-1 text-accent">
            [archived view]
          </span>
        )}
      </div>
    </div>
  );
};
