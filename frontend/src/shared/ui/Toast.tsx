import { AlertCircle, AlertTriangle, Check, Info } from "lucide-react";
import type React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useErrorDialogStore } from "../stores/errorDialog.store";
import { GlobalErrorDialog } from "./GlobalErrorDialog";
import {
	ToastProvider as RadixToastProvider,
	ToastAction,
	ToastClose,
	ToastDescription,
	Toast as ToastRoot,
	ToastViewport,
} from "./toast-primitives";

export type ToastType = "success" | "error" | "info" | "warning";

/** An optional action button rendered inside a toast (e.g. "Undo"). */
export interface ToastActionOption {
	label: string;
	onClick: () => void;
}

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
	action?: ToastActionOption;
}

interface Toast {
	id: string;
	title?: string;
	message: string;
	type: ToastType;
	duration: number;
	position: string;
	createdAt: number;
	action?: ToastActionOption;
}

interface ToastContextValue {
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

const getIcon = (type: ToastType) => {
	switch (type) {
		case "success":
			return <Check className="w-4 h-4 text-emerald-400" />;
		case "error":
			return <AlertCircle className="w-4 h-4 text-rose-400" />;
		case "warning":
			return <AlertTriangle className="w-4 h-4 text-amber-300" />;
		default:
			return <Info className="w-4 h-4 text-sky-400" />;
	}
};

const getVariant = (type: ToastType): "default" | "success" | "error" | "warning" => {
	switch (type) {
		case "success":
			return "success";
		case "error":
			return "error";
		case "warning":
			return "warning";
		default:
			return "default";
	}
};

const ToastItem: React.FC<{
	toast: Toast;
	onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
	// Only an explicit numeric 0/Infinity means persistent. Guarding on the type
	// avoids `!Number.isFinite(undefined) === true` turning default-duration
	// toasts persistent.
	const isPersistent =
		typeof toast.duration === "number" && (toast.duration === 0 || !Number.isFinite(toast.duration));
	return (
		<ToastRoot
			variant={getVariant(toast.type)}
			duration={isPersistent ? 0 : toast.duration}
			onOpenChange={(open) => {
				if (!open) {
					onDismiss(toast.id);
				}
			}}
		>
			<div className="p-3">
				<div className="flex items-start">
					<div className="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
					<div className="ml-2 flex-1 min-w-0 max-h-[40vh] overflow-y-auto">
						<ToastDescription>{toast.message}</ToastDescription>
					</div>
					<div className="flex flex-shrink-0 items-center gap-1 ml-2">
						{toast.action && (
							<ToastAction
								altText={toast.action.label}
								onClick={() => {
									toast.action?.onClick();
									onDismiss(toast.id);
								}}
							>
								{toast.action.label}
							</ToastAction>
						)}
						<ToastClose />
					</div>
				</div>
			</div>
		</ToastRoot>
	);
};

const getViewportPositionClasses = (position: string) => {
	switch (position) {
		case "top-left":
			return "top-0 left-0";
		case "top-center":
			return "top-0 left-1/2 -translate-x-1/2";
		case "top-right":
			return "top-0 right-0";
		case "bottom-left":
			return "bottom-0 left-0";
		case "bottom-center":
			return "bottom-0 left-1/2 -translate-x-1/2";
		default:
			return "bottom-0 right-0";
	}
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
				action: options.action,
			};

			setToasts((prev) => {
				// Re-showing an identical toast (same explicit id and content) is a
				// no-op. Without this, a caller that re-fires on context change (e.g.
				// an effect depending on the toast API) replaces the toast object
				// every pass — each replacement re-renders the provider, which loops
				// into "Maximum update depth exceeded" (React #185).
				const existing = prev.find((t) => t.id === id);
				if (
					existing &&
					existing.message === newToast.message &&
					existing.type === newToast.type &&
					existing.duration === newToast.duration &&
					existing.position === newToast.position &&
					!existing.action &&
					!newToast.action
				) {
					return prev;
				}
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

	// Errors route to the global error dialog (not a toast): a toast can grow
	// off-screen for long messages (e.g. a git conflict dump) and auto-dismiss
	// before the user reads it. The dialog is scrollable and must be dismissed.
	const error = useCallback((message: string, _options?: ToastOptions) => {
		useErrorDialogStore.getState().showError(message);
		return "";
	}, []);

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

	// Actions only — deliberately NOT including `toasts`. Every callback here is
	// identity-stable, so the context value never changes after mount. Including
	// the toasts array made the API object change on every toast update, which
	// re-fired consumer effects that show toasts (SyncToast) → infinite
	// show/replace loop → React #185 crash.
	const contextValue = useMemo<ToastContextValue>(
		() => ({
			show,
			success,
			error,
			info,
			warning,
			dismiss,
			dismissAll,
		}),
		[show, success, error, info, warning, dismiss, dismissAll],
	);

	return (
		<ToastContext.Provider value={contextValue}>
			<RadixToastProvider swipeDirection="right">
				{children}
				<GlobalErrorDialog />
				{Object.entries(toastsByPosition).map(([position, positionToasts]) => (
					<ToastViewport key={position} className={getViewportPositionClasses(position)}>
						{positionToasts.map((toast) => (
							<ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
						))}
					</ToastViewport>
				))}
			</RadixToastProvider>
		</ToastContext.Provider>
	);
};
