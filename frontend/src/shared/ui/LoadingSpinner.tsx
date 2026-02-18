import type React from "react";
import { useEffect } from "react";

interface LoadingSpinnerProps {
	message?: string;
	fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
	message = "Loading...",
	fullScreen = true,
}) => {
	useEffect(() => {
		const startTime = Date.now();

		const timer = setInterval(() => {
			const seconds = Math.floor((Date.now() - startTime) / 1000);

			if (seconds === 10) {
				if (import.meta.env.DEV) {
					console.error("[LoadingSpinner] Still loading after 10 seconds - likely stuck!");
				}
			}
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	}, []);

	const containerClass = fullScreen
		? "fixed inset-0 flex items-center justify-center bg-glass-bg/40 backdrop-blur-sm z-50"
		: "flex items-center justify-center h-full w-full";

	return (
		<div className={containerClass}>
			<div className="flex flex-col items-center gap-4">
				<div className="relative">
					<div className="w-12 h-12 border-4 border-glass-border rounded-full"></div>
					<div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
				</div>
				<div className="text-text-dim text-sm font-mono">{message}</div>
			</div>
		</div>
	);
};
