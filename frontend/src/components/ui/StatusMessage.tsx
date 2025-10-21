import React, { useEffect } from "react";
import { cn } from "../../lib/utils";

export interface StatusMessageProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  isVisible: boolean;
  onHide: () => void;
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  message,
  type = "success",
  duration = 3000,
  isVisible,
  onHide,
  className,
}) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onHide();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onHide]);

  if (!isVisible) return null;

  const typeStyles = {
    success: "border-green text-green",
    error: "border-red text-red",
    info: "border-accent text-accent",
  };

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 px-4 py-2 bg-surface border rounded text-sm font-medium",
        typeStyles[type],
        className
      )}
    >
      {message}
    </div>
  );
};
