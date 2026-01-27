import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import type React from "react";
import { cn } from "../../lib/utils";
import type { ParsedGitError } from "../../utils/gitErrorParser";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export interface GitErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  error: ParsedGitError | null;
}

export const GitErrorDialog: React.FC<GitErrorDialogProps> = ({ isOpen, onClose, error }) => {
  if (!error) return null;

  const getIcon = () => {
    switch (error.type) {
      case "CONFLICT":
        return <AlertTriangle className="text-3xl text-yellow-500" />;
      case "NETWORK":
        return <AlertCircle className="text-3xl text-red-500" />;
      case "INFO":
        return <Info className="text-3xl text-blue-500" />;
      default:
        return <AlertCircle className="text-3xl text-red-500" />;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn("sm:max-w-2xl p-0 bg-surface border-border overflow-hidden")}
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-start justify-between px-6 py-4 border-b border-border gap-0">
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle className="text-lg font-semibold text-text-bright">{error.title}</DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-text-dim hover:text-text-bright p-1"
          >
            <X className="text-2xl" />
          </Button>
        </DialogHeader>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-bg rounded-lg p-4 border border-border">
            <pre className="text-xs text-text-dim font-mono whitespace-pre-wrap break-words leading-relaxed">
              {error.technicalDetails}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
