import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import React, { useRef, useState } from "react";
import type { Status } from "../../bindings/yanta/internal/mcpctl/models";
import { Button, Input, Label, SettingsSection, Toggle } from "../shared/ui";
import { cn } from "../shared/utils/cn";

interface McpSectionProps {
	status: Status | null;
	busy: boolean;
	onSetEnabled: (enabled: boolean) => void;
	onSetPort: (port: number) => void;
	onRegenerateToken: () => void;
}

type AgentId = "claude" | "codex" | "opencode" | "http";

interface AgentGuide {
	id: AgentId;
	label: string;
	/**
	 * stdio agents spawn `yanta mcp` (the built-in bridge to this running app),
	 * so the `yanta` binary must be on PATH. Direct HTTP talks to the server
	 * itself and needs nothing on PATH.
	 */
	needsPath: boolean;
	/** Line above the snippet: where the config goes / what the command does. */
	lead: React.ReactNode;
	/** The copy-ready snippet. `url` is the live loopback URL for Direct HTTP. */
	snippet: (url: string) => string;
	footnote?: React.ReactNode;
}

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<code className="rounded bg-accent/10 px-1 py-0.5 font-mono text-[11px] text-text">
		{children}
	</code>
);

const AGENTS: AgentGuide[] = [
	{
		id: "claude",
		label: "Claude Code",
		needsPath: true,
		lead: "Register Yanta with Claude Code:",
		snippet: () => "claude mcp add yanta -- yanta mcp",
	},
	{
		id: "codex",
		label: "Codex",
		needsPath: true,
		lead: (
			<>
				Add to <Mono>~/.codex/config.toml</Mono>:
			</>
		),
		snippet: () => '[mcp_servers.yanta]\ncommand = "yanta"\nargs = ["mcp"]',
	},
	{
		id: "opencode",
		label: "opencode",
		needsPath: true,
		lead: (
			<>
				Add to <Mono>opencode.json</Mono>:
			</>
		),
		snippet: () => '{ "mcp": { "yanta": { "type": "local", "command": ["yanta", "mcp"] } } }',
	},
	{
		id: "http",
		label: "Direct HTTP",
		needsPath: false,
		lead: "For clients that speak Streamable HTTP directly — no PATH setup needed:",
		snippet: (url) =>
			`claude mcp add --transport http yanta ${url || "http://127.0.0.1:47600/"} \\\n  --header "Authorization: Bearer <TOKEN>"`,
		footnote: (
			<>
				Reveal and copy <span className="font-medium text-text">&lt;TOKEN&gt;</span> from{" "}
				<span className="font-medium text-text">Server credentials</span> below.
			</>
		),
	},
];

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

/** A copyable command / config block. Preserves whitespace for multi-line snippets. */
const CodeRow: React.FC<{ value: string }> = ({ value }) => (
	<div className="flex items-start gap-2">
		<pre className="flex-1 overflow-x-auto whitespace-pre rounded bg-accent/10 p-2 font-mono text-[11px] leading-relaxed text-text">
			{value}
		</pre>
		<CopyButton value={value} />
	</div>
);

export const McpSection = React.forwardRef<HTMLDivElement, McpSectionProps>(
	({ status, busy, onSetEnabled, onSetPort, onRegenerateToken }, ref) => {
		const [showToken, setShowToken] = useState(false);
		const [activeAgent, setActiveAgent] = useState<AgentId>("claude");
		const tabRefs = useRef<Partial<Record<AgentId, HTMLButtonElement | null>>>({});

		const enabled = status?.enabled ?? false;
		const running = status?.running ?? false;
		const err = status?.error ?? "";

		const agent = AGENTS.find((a) => a.id === activeAgent) ?? AGENTS[0];

		// Roving-tabindex keyboard nav so the picker is fully operable without a mouse.
		const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
			let next = index;
			if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % AGENTS.length;
			else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
				next = (index - 1 + AGENTS.length) % AGENTS.length;
			else if (e.key === "Home") next = 0;
			else if (e.key === "End") next = AGENTS.length - 1;
			else return;
			e.preventDefault();
			const id = AGENTS[next].id;
			setActiveAgent(id);
			tabRefs.current[id]?.focus();
		};

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
							<>
								<div className="space-y-3 border-t border-border pt-4">
									<Label variant="uppercase">Connect an agent</Label>

									{/* Agent picker — every supported client's setup lives here, inline. */}
									<div
										role="tablist"
										aria-label="Agent"
										className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-bg/50 p-0.5"
									>
										{AGENTS.map((a, i) => {
											const active = a.id === activeAgent;
											return (
												<button
													key={a.id}
													type="button"
													role="tab"
													id={`mcp-tab-${a.id}`}
													aria-selected={active}
													aria-controls={`mcp-panel-${a.id}`}
													tabIndex={active ? 0 : -1}
													ref={(el) => {
														tabRefs.current[a.id] = el;
													}}
													onClick={() => setActiveAgent(a.id)}
													onKeyDown={(e) => onTabKeyDown(e, i)}
													className={cn(
														"rounded-md px-3 py-1.5 text-xs transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
														active
															? "bg-accent/12 text-accent font-medium"
															: "text-text-dim hover:bg-accent/8 hover:text-text",
													)}
												>
													{a.label}
												</button>
											);
										})}
									</div>

									<div
										role="tabpanel"
										id={`mcp-panel-${agent.id}`}
										aria-labelledby={`mcp-tab-${agent.id}`}
										className="space-y-3"
									>
										<div className="space-y-1.5">
											<div className="text-xs text-text-dim">{agent.lead}</div>
											<CodeRow value={agent.snippet(status?.url ?? "")} />
											{agent.needsPath ? (
												<div className="text-xs text-text-dim">
													Requires the <Mono>yanta</Mono> binary on your PATH.
												</div>
											) : null}
											{agent.footnote ? <div className="text-xs text-text-dim">{agent.footnote}</div> : null}
										</div>
									</div>
								</div>

								{/* Server credentials — the single source for the URL and bearer token. */}
								<div className="space-y-2 border-t border-border pt-4">
									<Label variant="uppercase">Server credentials</Label>
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
							</>
						) : null}
					</div>
				</SettingsSection>
			</div>
		);
	},
);

McpSection.displayName = "McpSection";
