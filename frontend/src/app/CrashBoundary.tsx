import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import React from "react";
import { Button } from "../shared/ui/Button";
import { BackendLogger, getLogBuffer } from "../shared/utils/backendLogger";

interface CrashBoundaryState {
	error: Error | null;
	componentStack: string | null;
	showDetails: boolean;
}

function buildCrashReport(error: Error, componentStack: string | null): string {
	const lines: string[] = [];
	const now = new Date().toISOString();

	lines.push("=== YANTA Crash Report ===");
	lines.push(`Timestamp: ${now}`);
	lines.push(`URL: ${window.location.href}`);
	lines.push(`User Agent: ${navigator.userAgent}`);
	lines.push("");

	lines.push("--- Error ---");
	lines.push(`Name: ${error.name}`);
	lines.push(`Message: ${error.message}`);
	if (error.stack) {
		lines.push("");
		lines.push("Stack Trace:");
		lines.push(error.stack);
	}

	if (componentStack) {
		lines.push("");
		lines.push("--- Component Stack ---");
		lines.push(componentStack);
	}

	const debugErrors = (window as { __YANTA_DEBUG__?: { errors?: unknown[] } }).__YANTA_DEBUG__
		?.errors;
	if (debugErrors?.length) {
		lines.push("");
		lines.push("--- Early Errors (pre-React) ---");
		for (const entry of debugErrors) {
			lines.push(JSON.stringify(entry));
		}
	}

	const buffer = getLogBuffer();
	if (buffer.length > 0) {
		lines.push("");
		lines.push("--- Console Log (most recent 200 entries) ---");
		for (const entry of buffer) {
			lines.push(`[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`);
		}
	}

	return lines.join("\n");
}

function downloadCrashReport(report: string) {
	const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `yanta-crash-${Date.now()}.log`;
	a.click();
	URL.revokeObjectURL(url);
}

export class CrashBoundary extends React.Component<
	{ children: React.ReactNode },
	CrashBoundaryState
> {
	state: CrashBoundaryState = { error: null, componentStack: null, showDetails: false };

	static getDerivedStateFromError(error: Error): Partial<CrashBoundaryState> {
		return { error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		const componentStack = info.componentStack ?? null;
		this.setState({ componentStack });
		BackendLogger.error("[CrashBoundary] Caught render error:", error);
		if (componentStack) {
			BackendLogger.error("[CrashBoundary] Component stack:", componentStack);
		}
	}

	handleDownload = () => {
		const { error, componentStack } = this.state;
		if (!error) return;
		const report = buildCrashReport(error, componentStack);
		downloadCrashReport(report);
	};

	handleReload = () => {
		window.location.reload();
	};

	toggleDetails = () => {
		this.setState((prev) => ({ showDetails: !prev.showDetails }));
	};

	render() {
		if (!this.state.error) {
			return this.props.children;
		}

		const { error, componentStack, showDetails } = this.state;

		return (
			<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-bg-dark/80 backdrop-blur-sm">
				<div className="w-[480px] max-w-[calc(100%-2rem)] rounded-xl bg-glass-bg/95 backdrop-blur-xl border border-glass-border p-6 shadow-2xl">
					<div className="flex items-center gap-2.5 mb-3">
						<AlertCircle className="size-5 text-red shrink-0" aria-hidden />
						<span className="text-base font-semibold text-text-bright">Something went wrong</span>
					</div>

					<p className="text-sm text-text-dim leading-relaxed mb-4">
						The app crashed unexpectedly. You can download a crash log to help diagnose the issue, then
						reload to continue.
					</p>

					<button
						type="button"
						onClick={this.toggleDetails}
						className="flex items-center gap-1.5 text-xs text-text-dim hover:text-text transition-colors mb-2"
						aria-label={showDetails ? "Hide error details" : "Show error details"}
					>
						{showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
						Error details
					</button>

					{showDetails && (
						<div className="bg-bg/50 border border-border rounded-lg p-3 mb-5 max-h-[120px] overflow-y-auto">
							<pre className="text-xs font-mono text-red m-0 whitespace-pre-wrap break-words">
								{error.name}: {error.message}
							</pre>
						</div>
					)}

					<div className="flex justify-end gap-2">
						<Button variant="secondary" size="sm" onClick={this.handleDownload}>
							Download Crash Log
						</Button>
						<Button variant="primary" size="sm" onClick={this.handleReload}>
							Reload App
						</Button>
					</div>
				</div>
			</div>
		);
	}
}
