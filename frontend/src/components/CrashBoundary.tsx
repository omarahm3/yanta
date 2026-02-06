import { AlertCircle } from "lucide-react";
import React from "react";
import { BackendLogger, getLogBuffer } from "../utils/backendLogger";

interface CrashBoundaryState {
	error: Error | null;
	componentStack: string | null;
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
	state: CrashBoundaryState = { error: null, componentStack: null };

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

	render() {
		if (!this.state.error) {
			return this.props.children;
		}

		const { error } = this.state;

		return (
			<div style={styles.overlay}>
				<div style={styles.dialog}>
					<div style={styles.header}>
						<AlertCircle size={20} color="#ef4444" />
						<span style={styles.title}>Something went wrong</span>
					</div>

					<p style={styles.subtitle}>
						The app crashed unexpectedly. You can download a crash log to help diagnose the issue, then
						reload to continue.
					</p>

					<div style={styles.errorBox}>
						<pre style={styles.errorText}>
							{error.name}: {error.message}
						</pre>
					</div>

					<div style={styles.footer}>
						<button type="button" style={styles.secondaryBtn} onClick={this.handleDownload}>
							Download Crash Log
						</button>
						<button type="button" style={styles.primaryBtn} onClick={this.handleReload}>
							Reload App
						</button>
					</div>
				</div>
			</div>
		);
	}
}

const styles: Record<string, React.CSSProperties> = {
	overlay: {
		position: "fixed",
		inset: 0,
		zIndex: 99999,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		backdropFilter: "blur(8px)",
		fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	},
	dialog: {
		backgroundColor: "rgba(30, 30, 36, 0.95)",
		border: "1px solid rgba(255, 255, 255, 0.08)",
		borderRadius: "12px",
		padding: "24px",
		maxWidth: "480px",
		width: "calc(100% - 32px)",
		boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
	},
	header: {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		marginBottom: "12px",
	},
	title: {
		fontSize: "16px",
		fontWeight: 600,
		color: "#f0f0f0",
	},
	subtitle: {
		fontSize: "13px",
		color: "#a0a0a8",
		lineHeight: "1.5",
		margin: "0 0 16px 0",
	},
	errorBox: {
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		border: "1px solid rgba(255, 255, 255, 0.06)",
		borderRadius: "8px",
		padding: "12px",
		marginBottom: "20px",
		maxHeight: "120px",
		overflowY: "auto",
	},
	errorText: {
		fontSize: "12px",
		fontFamily: "'JetBrains Mono', monospace",
		color: "#ef4444",
		margin: 0,
		whiteSpace: "pre-wrap",
		wordBreak: "break-word",
	},
	footer: {
		display: "flex",
		justifyContent: "flex-end",
		gap: "8px",
	},
	primaryBtn: {
		padding: "8px 16px",
		fontSize: "13px",
		fontWeight: 500,
		fontFamily: "inherit",
		borderRadius: "8px",
		border: "none",
		cursor: "pointer",
		backgroundColor: "#6366f1",
		color: "#fff",
		transition: "opacity 0.15s",
	},
	secondaryBtn: {
		padding: "8px 16px",
		fontSize: "13px",
		fontWeight: 500,
		fontFamily: "inherit",
		borderRadius: "8px",
		border: "1px solid rgba(255, 255, 255, 0.1)",
		cursor: "pointer",
		backgroundColor: "transparent",
		color: "#a0a0a8",
		transition: "opacity 0.15s",
	},
};
