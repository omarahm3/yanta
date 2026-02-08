import { AlertCircle } from "lucide-react";
import React from "react";
import { BackendLogger } from "../utils/backendLogger";

export interface GranularErrorBoundaryProps {
	children: React.ReactNode;
	/** Short message shown in recovery UI, e.g. "Something went wrong in the editor." */
	message: string;
	/** Called when user clicks reload; parent should remount this boundary (e.g. by changing key). */
	onRetry?: () => void;
}

interface State {
	error: Error | null;
}

/**
 * Error boundary for a single area (editor, settings, list). Shows recovery UI
 * without taking down the rest of the app. Use with a key so onRetry can remount.
 */
export class GranularErrorBoundary extends React.Component<GranularErrorBoundaryProps, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		BackendLogger.error("[GranularErrorBoundary] Caught error:", error);
		if (info.componentStack) {
			BackendLogger.error("[GranularErrorBoundary] Component stack:", info.componentStack);
		}
	}

	handleRetry = () => {
		this.props.onRetry?.();
	};

	render() {
		if (!this.state.error) {
			return this.props.children;
		}

		return (
			<div
				className="flex flex-col items-center justify-center gap-4 p-8 rounded-xl bg-glass-bg/30 border border-glass-border text-center min-h-[120px]"
				role="alert"
			>
				<AlertCircle className="size-8 text-red shrink-0" aria-hidden />
				<p className="text-text-bright font-medium">{this.props.message}</p>
				{this.props.onRetry && (
					<button
						type="button"
						onClick={this.handleRetry}
						className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-opacity"
					>
						Click to reload
					</button>
				)}
			</div>
		);
	}
}
