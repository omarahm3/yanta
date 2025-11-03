import { notifications } from "@mantine/notifications";
import { useCallback } from "react";

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
	const showNotification = useCallback(
		(message: string, type: NotificationType = "info", options: NotificationOptions = {}) => {
			const { duration = 4000, position = "bottom-right", id } = options;

			const mantineOptions = {
				message,
				autoClose: duration,
				position: position,
				id,
				withCloseButton: true,
			};

			switch (type) {
				case "success":
					return notifications.show({
						...mantineOptions,
						color: "green",
						title: "Success",
					});
				case "error":
					return notifications.show({
						...mantineOptions,
						color: "red",
						title: "Error",
					});
				case "warning":
					return notifications.show({
						...mantineOptions,
						color: "orange",
						title: "Warning",
					});
				case "info":
				default:
					return notifications.show({
						...mantineOptions,
						color: "blue",
						title: "Info",
					});
			}
		},
		[],
	);

	const success = useCallback(
		(message: string, options?: NotificationOptions) => {
			return showNotification(message, "success", options);
		},
		[showNotification],
	);

	const error = useCallback(
		(message: string, options?: NotificationOptions) => {
			return showNotification(message, "error", options);
		},
		[showNotification],
	);

	const info = useCallback(
		(message: string, options?: NotificationOptions) => {
			return showNotification(message, "info", options);
		},
		[showNotification],
	);

	const warning = useCallback(
		(message: string, options?: NotificationOptions) => {
			return showNotification(message, "warning", options);
		},
		[showNotification],
	);

	const dismiss = useCallback((notificationId?: string) => {
		if (notificationId) {
			notifications.hide(notificationId);
		} else {
			notifications.clean();
		}
	}, []);

	const dismissAll = useCallback(() => {
		notifications.clean();
	}, []);

	return {
		show: showNotification,
		success,
		error,
		info,
		warning,
		dismiss,
		dismissAll,
	};
};
