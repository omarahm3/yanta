import React from "react";

interface StatusBarProps {
  totalEntries: number;
  currentContext: string;
  showArchived?: boolean;
  selectedCount?: number;
  onClearSelection?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalEntries,
  currentContext,
  showArchived,
  selectedCount = 0,
  onClearSelection,
}) => {
  const entriesLabel =
    totalEntries === 1 ? "1 entry" : `${totalEntries} entries`;
  const hasSelection = selectedCount > 0;
  const selectionLabel =
    selectedCount === 1
      ? "1 document selected"
      : `${selectedCount} documents selected`;

  return (
    <div className="flex w-full flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-2 text-xs text-text-dim font-sans">
      <div className="flex items-center gap-3 whitespace-nowrap text-text">
        <span>{entriesLabel}</span>
        {showArchived && (
          <span className="flex items-center gap-1 text-accent">
            [archived view]
          </span>
        )}
      </div>
      {hasSelection && (
        <div className="flex flex-wrap items-center gap-2 text-text">
          <span className="font-semibold">{selectionLabel}</span>
          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded border border-border px-2 py-1 text-xs text-text transition-colors hover:bg-bg"
            >
              Clear Selection
            </button>
          )}
        </div>
      )}
      <div className="ml-auto flex items-center gap-1 whitespace-nowrap">
        <span>Context:</span>
        <span className="text-text">{currentContext}</span>
      </div>
    </div>
  );
};
