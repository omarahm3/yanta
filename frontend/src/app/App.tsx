import React from "react";
import { BackendLogger } from "../shared/utils/backendLogger";
import { AppProviders } from "./providers";

function App() {
	React.useEffect(() => {
		const isResizeObserverLoopNoise = (msg: string | undefined): boolean => {
			if (!msg) return false;
			return (
				msg.includes("ResizeObserver loop completed with undelivered notifications") ||
				msg.includes("ResizeObserver loop limit exceeded")
			);
		};

		// Wails serves /wails/custom.js from its runtime; when no custom.js is
		// registered some Wails builds return HTML instead of a 404, which
		// surfaces as a one-shot "Unexpected token '<'" SyntaxError at load.
		// Harmless — suppress to stop the log spam.
		const isWailsCustomJsNoise = (msg: string | undefined, filename: string | undefined): boolean => {
			if (!msg || !filename) return false;
			return filename.includes("/wails/custom.js") && msg.includes("Unexpected token");
		};

		const handleError = (event: ErrorEvent) => {
			if (isResizeObserverLoopNoise(event.message)) {
				event.stopImmediatePropagation();
				return;
			}
			if (isWailsCustomJsNoise(event.message, event.filename)) {
				event.stopImmediatePropagation();
				return;
			}
			BackendLogger.error("[App] Uncaught error:", {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				error: event.error,
			});
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			const reasonMsg =
				typeof event.reason === "string"
					? event.reason
					: event.reason instanceof Error
						? event.reason.message
						: undefined;
			if (isResizeObserverLoopNoise(reasonMsg)) {
				event.preventDefault();
				return;
			}
			BackendLogger.error("[App] Unhandled promise rejection:", {
				reason: event.reason,
				promise: event.promise,
			});
		};

		window.addEventListener("error", handleError);
		window.addEventListener("unhandledrejection", handleUnhandledRejection);

		BackendLogger.info("[App] Global error handlers registered");

		return () => {
			window.removeEventListener("error", handleError);
			window.removeEventListener("unhandledrejection", handleUnhandledRejection);
		};
	}, []);

	return <AppProviders />;
}

export default App;
