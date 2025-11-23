import { useToast } from "../components/ui/Toast";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationOptions {
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

export const useNotification = () => {
	const toast = useToast();

	return {
		show: toast.show,
		success: toast.success,
		error: toast.error,
		info: toast.info,
		warning: toast.warning,
		dismiss: toast.dismiss,
		dismissAll: toast.dismissAll,
	};
};
