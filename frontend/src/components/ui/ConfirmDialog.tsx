import React from "react";
import { cn } from "../../lib/utils";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-surface border-2 border-border rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold tracking-wide text-text">
            {title}
          </h2>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-text-dim">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border rounded transition-colors bg-transparent border-border text-text hover:bg-bg"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded transition-colors",
              danger
                ? "bg-red text-bg hover:bg-red/80 border border-red"
                : "bg-accent text-bg hover:bg-accent/80 border border-accent"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
