import React from "react";
import { SaveState } from "../../hooks/useAutoSave";

interface DocumentEditorActionsProps {
  isEditMode: boolean;
  saveState: SaveState;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  saveError: Error | null;
  onCancel: () => void;
  onSaveNow?: () => void;
}

const formatTimeSince = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export const DocumentEditorActions: React.FC<DocumentEditorActionsProps> = ({
  isEditMode,
  saveState,
  lastSaved,
  hasUnsavedChanges,
  saveError,
  onCancel,
  onSaveNow,
}) => {
  const getSaveStatusText = () => {
    if (saveState === "saving") return "Saving...";
    if (saveState === "error" && saveError)
      return `Error: ${saveError.message}`;
    if (saveState === "saved" && lastSaved)
      return `Saved ${formatTimeSince(lastSaved)}`;
    if (hasUnsavedChanges) return "Unsaved changes";
    if (isEditMode && lastSaved) return `Saved ${formatTimeSince(lastSaved)}`;
    return "Ready";
  };

  const getStatusColor = () => {
    if (saveState === "saving") return "text-accent";
    if (saveState === "error") return "text-red";
    if (saveState === "saved") return "text-green";
    return "text-text-dim";
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg">
      <div className={`text-sm ${getStatusColor()}`}>{getSaveStatusText()}</div>

      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium transition-colors text-text-dim hover:text-text"
          disabled={saveState === "saving"}
        >
          {isEditMode ? "Close" : "Cancel"}
        </button>
        {onSaveNow && hasUnsavedChanges && (
          <button
            onClick={onSaveNow}
            disabled={saveState === "saving"}
            className="px-6 py-2 text-sm font-medium transition-colors rounded bg-accent text-bg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveState === "saving" ? "Saving..." : "Save Now"}
          </button>
        )}
      </div>
    </div>
  );
};
