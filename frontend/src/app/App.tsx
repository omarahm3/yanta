import React from "react";
import { BackendLogger } from "../utils/backendLogger";
import { AppProviders } from "./providers";

function App() {
	React.useEffect(() => {
		const handleError = (event: ErrorEvent) => {
			BackendLogger.error("[App] Uncaught error:", {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				error: event.error,
			});
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
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
