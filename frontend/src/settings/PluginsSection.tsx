import React, { useMemo, useState } from "react";
import { Button, ConfirmDialog, SettingsSection, Toggle } from "../shared/ui";
import type { PluginInstallRecord } from "./usePluginSettings";

interface PluginsSectionProps {
	plugins: PluginInstallRecord[];
	isLoading: boolean;
	errorMessage: string | null;
	pluginDirectory?: string;
	communityPluginsEnabled: boolean;
	onReload: () => Promise<void>;
	onInstall: () => Promise<void>;
	onToggleEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
	onUninstall: (pluginId: string) => Promise<void>;
	onCommunityPluginsEnabledChange: (enabled: boolean) => Promise<void>;
}

const STATUS_LABELS: Record<string, string> = {
	ok: "OK",
	invalid_manifest: "Invalid Manifest",
	incompatible_api: "Incompatible API",
};

const STATUS_CLASSES: Record<string, string> = {
	ok: "text-green border-green/30 bg-green/10",
	invalid_manifest: "text-yellow border-yellow/30 bg-yellow/10",
	incompatible_api: "text-red border-red/30 bg-red/10",
};

export const PluginsSection = React.forwardRef<HTMLDivElement, PluginsSectionProps>(
	(
		{
			plugins,
			isLoading,
			errorMessage,
			pluginDirectory,
			communityPluginsEnabled,
			onReload,
			onInstall,
			onToggleEnabled,
			onUninstall,
			onCommunityPluginsEnabledChange,
		},
		ref,
	) => {
		const [pendingUninstallId, setPendingUninstallId] = useState<string | null>(null);
		const pluginList = Array.isArray(plugins) ? plugins : [];

		const pendingPlugin = useMemo(
			() => pluginList.find((plugin) => plugin.manifest.ID === pendingUninstallId),
			[pluginList, pendingUninstallId],
		);

		return (
			<div ref={ref}>
				<SettingsSection
					title="Plugins"
					subtitle="Manage installed plugins and runtime state"
					actions={
						<div className="flex gap-2">
							<Button variant="secondary" size="sm" onClick={() => void onReload()} disabled={isLoading}>
								Refresh
							</Button>
							<Button size="sm" onClick={() => void onInstall()}>
								Install Plugin
							</Button>
						</div>
					}
				>
					<div className="space-y-4">
						{pluginDirectory && (
							<div className="text-xs text-text-dim">
								Plugin directory: <span className="font-mono">{pluginDirectory}</span>
							</div>
						)}

						<div className="p-3 border rounded border-border bg-bg-secondary space-y-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<div className="text-sm font-medium text-text">Community Plugins</div>
									<div className="text-xs text-text-dim mt-1">
										Restricted Mode: disable this to prevent external plugin code execution.
									</div>
								</div>
								<Toggle
									checked={communityPluginsEnabled}
									onChange={(checked) => void onCommunityPluginsEnabledChange(checked)}
								/>
							</div>
						</div>

						{isLoading && <div className="text-sm text-text-dim">Loading plugins...</div>}

						{errorMessage && (
							<div className="p-3 border rounded border-red/40 bg-red/10 text-sm text-red">
								{errorMessage}
							</div>
						)}

						{!isLoading && !errorMessage && pluginList.length === 0 && (
							<div className="p-3 border rounded border-border bg-bg-secondary text-sm text-text-dim">
								No plugins installed yet.
							</div>
						)}

						{pluginList.map((plugin) => {
							const status = plugin.status ?? "ok";
							const pluginId = plugin.manifest.ID;
							const pluginName = plugin.manifest.Name || pluginId;
							const canExecute = (plugin as unknown as { canExecute?: boolean }).canExecute ?? true;
							const isolation = (plugin as unknown as { isolation?: string }).isolation ?? "unknown";
							const isOperational =
								status === "ok" && Boolean(pluginId) && canExecute && communityPluginsEnabled;
							const issues = plugin.issues ?? [];

							return (
								<div
									key={`${plugin.path}:${pluginId}`}
									className="p-4 border rounded border-border bg-bg-secondary space-y-3"
								>
									<div className="flex items-start justify-between gap-4">
										<div>
											<div className="text-sm font-medium text-text">{pluginName}</div>
											<div className="text-xs text-text-dim font-mono mt-1">{pluginId}</div>
											<div className="text-xs text-text-dim mt-2">
												version {plugin.manifest.Version} | api {plugin.manifest.APIVersion} | source{" "}
												{plugin.source}
											</div>
											<div className="text-xs text-text-dim mt-1">
												isolation {isolation} | executable {canExecute ? "yes" : "no"}
											</div>
										</div>
										<span
											className={`px-2 py-0.5 rounded border text-[11px] uppercase tracking-wide ${STATUS_CLASSES[status] ?? STATUS_CLASSES.invalid_manifest}`}
										>
											{STATUS_LABELS[status] ?? "Invalid"}
										</span>
									</div>

									{issues.length > 0 && (
										<div className="text-xs text-yellow">
											{issues.map((issue, idx) => (
												<div key={`${pluginId}-issue-${idx}`}>
													{issue.field ? `${issue.field}: ` : ""}
													{issue.message}
												</div>
											))}
										</div>
									)}

									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="text-sm text-text">Enabled</div>
											<Toggle
												checked={plugin.enabled}
												onChange={(checked) => void onToggleEnabled(pluginId, checked)}
												disabled={!isOperational}
											/>
										</div>
										<Button
											variant="destructive"
											size="sm"
											onClick={() => setPendingUninstallId(pluginId)}
											disabled={!pluginId}
										>
											Uninstall
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				</SettingsSection>

				<ConfirmDialog
					isOpen={pendingUninstallId !== null}
					title="Uninstall Plugin?"
					message={
						pendingPlugin
							? `This will remove "${pendingPlugin.manifest.Name || pendingPlugin.manifest.ID}" and delete its saved plugin configuration.`
							: "This will remove the selected plugin and delete its saved plugin configuration."
					}
					confirmText="Uninstall"
					cancelText="Cancel"
					danger
					onCancel={() => setPendingUninstallId(null)}
					onConfirm={() => {
						if (!pendingUninstallId) return;
						void onUninstall(pendingUninstallId);
						setPendingUninstallId(null);
					}}
				/>
			</div>
		);
	},
);

PluginsSection.displayName = "PluginsSection";
