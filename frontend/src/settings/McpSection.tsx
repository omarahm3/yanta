import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import type { Status } from "../../bindings/yanta/internal/mcpctl/models";
import { Button, Input, Label, SettingsSection, Toggle } from "../shared/ui";
import { cn } from "../shared/utils/cn";

const BRIDGE_COMMAND = "claude mcp add yanta -- yanta-mcp";

interface McpSectionProps {
	status: Status | null;
	busy: boolean;
	onSetEnabled: (enabled: boolean) => void;
	onSetPort: (port: number) => void;
	onRegenerateToken: () => void;
}

const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		navigator.clipboard.writeText(value).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};
	return (
		<Button variant="ghost" size="sm" onClick={copy} title="Copy to clipboard">
			{copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
			{label ? <span className="ml-1">{copied ? "Copied" : label}</span> : null}
		</Button>
	);
};

export const McpSection = React.forwardRef<HTMLDivElement, McpSectionProps>(
	({ status, busy, onSetEnabled, onSetPort, onRegenerateToken }, ref) => {
		const [showToken, setShowToken] = useState(false);

		const enabled = status?.enabled ?? false;
		const running = status?.running ?? false;
		const err = status?.error ?? "";

		const tone: "green" | "yellow" | "red" | "neutral" = err
			? "red"
			: running
				? "green"
				: enabled
					? "yellow"
					: "neutral";
		const toneClass = {
			green: "border-green/40 bg-green/10",
			yellow: "border-yellow/40 bg-yellow/10",
			red: "border-red/40 bg-red/10",
			neutral: "border-border bg-surface",
		}[tone];
		const dotClass = {
			green: "bg-green",
			yellow: "bg-yellow",
			red: "bg-red",
			neutral: "bg-text-dim",
		}[tone];
		const statusLabel = err ? "Error" : running ? "Running" : enabled ? "Starting…" : "Stopped";

		return (
			<div ref={ref}>
				<SettingsSection
					id="mcp"
					title="MCP Server"
					subtitle="Let AI agents (Claude Code, Codex, opencode) read and edit your vault over the Model Context Protocol"
				>
					<div className="space-y-4">
						{/* Live status */}
						<div className={cn("flex items-center gap-3 rounded-md border p-3", toneClass)}>
							<span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotClass)} />
							<div className="min-w-0 flex-1">
								<div className="text-sm font-medium text-text">{statusLabel}</div>
								{running && status?.url ? (
									<div className="truncate text-xs text-text-dim">{status.url}</div>
								) : null}
								{err ? <div className="text-xs text-red">{err}</div> : null}
							</div>
						</div>

						{/* Enable */}
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-text">Enable MCP server</div>
								<div className="text-xs text-text-dim">
									Runs a local server on 127.0.0.1 that agents connect to. Off by default.
								</div>
							</div>
							<Toggle checked={enabled} onChange={onSetEnabled} disabled={busy || !status} />
						</div>

						{/* Port */}
						<div className="space-y-2">
							<Label variant="uppercase">Port</Label>
							<Input
								variant="default"
								type="number"
								min={1024}
								max={65535}
								value={(status?.port ?? 47600).toString()}
								disabled={busy || !status}
								onChange={(e) => {
									const value = Number.parseInt(e.target.value, 10);
									if (!Number.isNaN(value) && value >= 1024 && value <= 65535) {
										onSetPort(value);
									}
								}}
								className="w-32"
							/>
							<div className="text-xs text-text-dim">Loopback port. Changing it restarts the server.</div>
						</div>

						{/* Connection details, shown while running */}
						{running ? (
							<div className="space-y-4 border-t border-border pt-4">
								<div className="space-y-2">
									<Label variant="uppercase">Connect an agent</Label>
									<div className="flex items-center gap-2">
										<pre className="flex-1 overflow-x-auto rounded bg-accent/10 p-2 font-mono text-[11px] text-text">
											{BRIDGE_COMMAND}
										</pre>
										<CopyButton value={BRIDGE_COMMAND} />
									</div>
									<div className="text-xs text-text-dim">
										Requires the <span className="font-mono">yanta-mcp</span> bridge on your PATH. See{" "}
										<span className="font-mono">docs/mcp.md</span> for Codex, opencode, and direct-HTTP setup.
									</div>
								</div>

								<div className="space-y-2">
									<Label variant="uppercase">Direct HTTP (advanced)</Label>
									<div className="flex items-center gap-2">
										<span className="w-12 shrink-0 text-xs text-text-dim">URL</span>
										<code className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-text">
											{status?.url}
										</code>
										<CopyButton value={status?.url ?? ""} />
									</div>
									<div className="flex items-center gap-2">
										<span className="w-12 shrink-0 text-xs text-text-dim">Token</span>
										<code className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-text">
											{showToken ? status?.token : "•".repeat(24)}
										</code>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setShowToken((s) => !s)}
											title={showToken ? "Hide token" : "Reveal token"}
										>
											{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										</Button>
										<CopyButton value={status?.token ?? ""} />
										<Button
											variant="ghost"
											size="sm"
											onClick={onRegenerateToken}
											disabled={busy}
											title="Regenerate token"
										>
											<RefreshCw className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</SettingsSection>
			</div>
		);
	},
);

McpSection.displayName = "McpSection";
