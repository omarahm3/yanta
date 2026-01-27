import { AlertCircle, AlertTriangle, Check, Info } from "lucide-react";
import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import {
	ToastProvider as RadixToastProvider,
	ToastClose,
	ToastDescription,
	Toast as ToastRoot,
	ToastTitle,
	ToastViewport,
} from "./toast-primitives";

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

const getIcon = (type: ToastType) => {
	switch (type) {
		case "success":
			return <Check className="w-5 h-5 text-emerald-400" />;
		case "error":
			return <AlertCircle className="w-5 h-5 text-rose-400" />;
		case "warning":
			return <AlertTriangle className="w-5 h-5 text-amber-300" />;
		default:
			return <Info className="w-5 h-5 text-sky-400" />;
	}
};

const getTitle = (toast: Toast) => {
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
	return (
		<ToastRoot
			variant={getVariant(toast.type)}
			duration={toast.duration}
			onOpenChange={(open) => {
				if (!open) {
					onDismiss(toast.id);
				}
			}}
		>
			<div className="p-4">
				<div className="flex items-start">
					<div className="flex-shrink-0">{getIcon(toast.type)}</div>
					<div className="ml-3 w-0 flex-1 pt-0.5">
						<ToastTitle>{getTitle(toast)}</ToastTitle>
						<ToastDescription>{toast.message}</ToastDescription>
					</div>
					<div className="flex flex-shrink-0 ml-4">
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
			};

			setToasts((prev) => {
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
		(message: string, options?: ToastOptions) => {
			const defaultDuration = message.length > 200 ? 10000 : 6000;
			return show(message, "error", { duration: defaultDuration, ...options });
		},
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
			<RadixToastProvider swipeDirection="right">
				{children}
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
