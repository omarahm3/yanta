import React from "react";
import {
  RiCircleLine,
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiRecordCircleFill,
} from "react-icons/ri";
import { SaveState } from "../../hooks/useAutoSave";

interface DocumentEditorActionsProps {
  isArchived?: boolean;
  saveState: SaveState;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  saveError: Error | null;
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
  isArchived = false,
  saveState,
  lastSaved,
  hasUnsavedChanges,
  saveError,
}) => {
  const getStatusIndicator = () => {
    if (isArchived) {
      return {
        icon: RiCircleLine,
        text: "Read-only",
        color: "text-accent",
        iconClass: "",
      };
    }
    if (saveState === "saving") {
      return {
        icon: RiLoader4Line,
        text: "Saving",
        color: "text-accent",
        iconClass: "animate-spin",
      };
    }
    if (saveState === "error" && saveError) {
      return {
        icon: RiCloseLine,
        text: saveError.message,
        color: "text-red",
        iconClass: "",
      };
    }
    if (hasUnsavedChanges) {
      return {
        icon: RiRecordCircleFill,
        text: "Unsaved",
        color: "text-yellow",
        iconClass: "",
      };
    }
    if (lastSaved) {
      return {
        icon: RiCheckLine,
        text: formatTimeSince(lastSaved),
        color: "text-green",
        iconClass: "",
      };
    }
    return {
      icon: RiCircleLine,
      text: "Ready",
      color: "text-text-dim",
      iconClass: "",
    };
  };

  const status = getStatusIndicator();
  const IconComponent = status.icon;

  return (
    <div className="flex items-center justify-center px-4 py-2 border-t border-border/50 bg-bg">
      <div className={`flex items-center gap-2 text-xs ${status.color}`}>
        <IconComponent className={status.iconClass} />
        <span>{status.text}</span>
      </div>
    </div>
  );
};
