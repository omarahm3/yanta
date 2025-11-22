import { Transition } from "@headlessui/react";
import React, {
  Fragment,
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiAlertLine,
} from "react-icons/ri";
import { cn } from "../../lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  duration?: number;
  position?:
  | "top-right"
  | "top-center"
  | "top-left"
  | "bottom-right"
  | "bottom-center"
  | "bottom-left";
  id?: string;
}

interface Toast {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration: number;
  position: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, type?: ToastType, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

const ToastItem: React.FC<{
  toast: Toast;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [isShowing, setIsShowing] = useState(true);

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsShowing(false);
        setTimeout(() => onDismiss(toast.id), 300); // Wait for transition
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <RiCheckLine className="h-5 w-5 text-green-400" />;
      case "error":
        return <RiErrorWarningLine className="h-5 w-5 text-red-400" />;
      case "warning":
        return <RiAlertLine className="h-5 w-5 text-orange-400" />;
      default:
        return <RiInformationLine className="h-5 w-5 text-blue-400" />;
    }
  };

  const getStyles = () => {
    const base =
      "pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800";
    switch (toast.type) {
      case "success":
        return cn(base, "border-l-4 border-green-500");
      case "error":
        return cn(base, "border-l-4 border-red-500");
      case "warning":
        return cn(base, "border-l-4 border-orange-500");
      default:
        return cn(base, "border-l-4 border-blue-500");
    }
  };

  const getTitle = () => {
    if (toast.title) return toast.title;
    switch (toast.type) {
      case "success":
        return "Success";
      case "error":
        return "Error";
      case "warning":
        return "Warning";
      default:
        return "Info";
    }
  };

  return (
    <Transition
      show={isShowing}
      as={Fragment}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enterTo="translate-y-0 opacity-100 sm:translate-x-0"
      leave="transition ease-in duration-100"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className={getStyles()}>
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">{getIcon()}</div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{getTitle()}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
            </div>
            <div className="ml-4 flex flex-shrink-0">
              <button
                type="button"
                className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
                onClick={() => {
                  setIsShowing(false);
                  setTimeout(() => onDismiss(toast.id), 300);
                }}
              >
                <span className="sr-only">Close</span>
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  );
};

const ToastContainer: React.FC<{
  position: string;
  toasts: Toast[];
  onDismiss: (id: string) => void;
}> = ({ position, toasts, onDismiss }) => {
  const getContainerStyles = () => {
    const base = "fixed z-50 flex flex-col gap-2 p-4 pointer-events-none";
    switch (position) {
      case "top-left":
        return cn(base, "top-0 left-0");
      case "top-center":
        return cn(base, "top-0 left-1/2 -translate-x-1/2");
      case "top-right":
        return cn(base, "top-0 right-0");
      case "bottom-left":
        return cn(base, "bottom-0 left-0");
      case "bottom-center":
        return cn(base, "bottom-0 left-1/2 -translate-x-1/2");
      case "bottom-right":
      default:
        return cn(base, "bottom-0 right-0");
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className={getContainerStyles()}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (message: string, type: ToastType = "info", options: ToastOptions = {}): string => {
      const id = options.id || `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message,
        type,
        duration: options.duration ?? 4000,
        position: options.position ?? "bottom-right",
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        // Remove existing toast with same id if any
        const filtered = prev.filter((t) => t.id !== id);
        return [...filtered, newToast];
      });

      return id;
    },
    [],
  );

  const dismiss = useCallback((id?: string) => {
    if (id) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    } else {
      setToasts([]);
    }
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback(
    (message: string, options?: ToastOptions) => show(message, "success", options),
    [show],
  );

  const error = useCallback(
    (message: string, options?: ToastOptions) => show(message, "error", options),
    [show],
  );

  const info = useCallback(
    (message: string, options?: ToastOptions) => show(message, "info", options),
    [show],
  );

  const warning = useCallback(
    (message: string, options?: ToastOptions) => show(message, "warning", options),
    [show],
  );

  // Group toasts by position
  const toastsByPosition = toasts.reduce(
    (acc, toast) => {
      if (!acc[toast.position]) {
        acc[toast.position] = [];
      }
      acc[toast.position].push(toast);
      return acc;
    },
    {} as Record<string, Toast[]>,
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        show,
        success,
        error,
        info,
        warning,
        dismiss,
        dismissAll,
      }}
    >
      {children}
      {Object.entries(toastsByPosition).map(([position, positionToasts]) => (
        <ToastContainer
          key={position}
          position={position}
          toasts={positionToasts}
          onDismiss={dismiss}
        />
      ))}
    </ToastContext.Provider>
  );
};

