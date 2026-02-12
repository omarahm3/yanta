import React from "react";
import type { GlobalHotkeyConfig } from "../shared/types";
import {
	Heading,
	HotkeyEditor,
	HotkeyInput,
	SettingsSection,
	type Shortcut,
	ShortcutsTable,
	Text,
} from "../shared/ui";

/** Shortcut IDs that users can override (subset of full shortcut list). */
const OVERRIDABLE_SHORTCUT_IDS = [
	{ id: "global.help", label: "Toggle help" },
	{ id: "global.commandPalette", label: "Open command palette" },
	{ id: "global.today", label: "Jump to today's journal" },
	{ id: "sidebar.toggle", label: "Toggle sidebar" },
	{ id: "dashboard.newDocument", label: "Create new document" },
	{ id: "document.save", label: "Save document" },
] as const;

interface ShortcutsSectionProps {
	platform: string;
	hotkeyConfig: GlobalHotkeyConfig;
	onHotkeyConfigChange: (config: GlobalHotkeyConfig) => void;
	hotkeyError?: string;
	shortcuts: Shortcut[];
	/** Override shortcuts (from preferences). Key: "group.key", value: key combo e.g. "mod+K" */
	shortcutOverrides?: Record<string, string>;
	onShortcutOverride?: (id: string, newKey: string) => void;
}

export const ShortcutsSection = React.forwardRef<HTMLDivElement, ShortcutsSectionProps>(
	(
		{
			platform,
			hotkeyConfig,
			onHotkeyConfigChange,
			hotkeyError,
			shortcuts,
			shortcutOverrides = {},
			onShortcutOverride,
		},
		ref,
	) => {
		const isWindows = platform === "windows";
		const isLinux = platform === "linux";
		const isMac = platform === "darwin";

		const handleHotkeyChange = (hotkey: string) => {
			onHotkeyConfigChange({
				...hotkeyConfig,
				quickCaptureHotkey: hotkey,
			});
		};

		const handleEnabledChange = (enabled: boolean) => {
			onHotkeyConfigChange({
				...hotkeyConfig,
				quickCaptureEnabled: enabled,
			});
		};

		return (
			<div ref={ref}>
				<SettingsSection
					title="Keyboard Shortcuts"
					subtitle="Configure global hotkeys and view application shortcuts"
				>
					<div className="space-y-6">
						{/* Global Hotkeys Section */}
						<div>
							<Heading as="h3" size="sm" variant="bright" weight="medium" className="mb-2">
								Global Hotkeys
							</Heading>

							{isWindows && (
								<div className="space-y-4">
									<Text size="sm" variant="dim" className="mb-4">
										Configure system-wide hotkeys that work even when YANTA is in the background.
									</Text>

									{/* Quick Capture Hotkey */}
									<div className="p-4 rounded border border-border bg-bg-secondary">
										<div className="mb-3">
											<div className="text-sm font-medium text-text">Quick Capture</div>
											<div className="text-xs text-text-dim">
												Click the input below and press your desired hotkey. Press Enter to save, Esc to cancel.
											</div>
										</div>
										<HotkeyEditor
											value={hotkeyConfig.quickCaptureHotkey}
											enabled={hotkeyConfig.quickCaptureEnabled}
											onValueChange={handleHotkeyChange}
											onEnabledChange={handleEnabledChange}
											error={hotkeyError}
										/>
									</div>

									{/* Restore Window Info */}
									<div className="p-3 rounded border border-border bg-bg-tertiary">
										<div className="text-sm text-text">Restore Window</div>
										<div className="text-xs text-text-dim">
											Press <span className="font-mono text-text-bright">Ctrl+Shift+Y</span> to show and focus
											the main YANTA window when it's hidden.
										</div>
									</div>
								</div>
							)}

							{(isLinux || isMac) && (
								<div className="p-4 rounded border border-border bg-bg-secondary">
									<div className="space-y-3">
										<Text size="sm" variant="dim">
											Global hotkeys require platform-specific configuration on {isMac ? "macOS" : "Linux"}.
										</Text>

										<div className="p-3 rounded bg-bg-tertiary">
											<div className="text-sm font-medium text-text mb-2">Quick Capture Command</div>
											<div className="font-mono text-sm text-accent-primary bg-bg p-2 rounded">
												yanta --quick
											</div>
										</div>

										{isLinux && (
											<div className="space-y-2">
												<div className="text-sm font-medium text-text">Configuration Guide (Linux)</div>
												<ul className="text-xs text-text-dim space-y-1 list-disc list-inside">
													<li>
														<strong>GNOME:</strong> Settings → Keyboard → Custom Shortcuts
													</li>
													<li>
														<strong>KDE:</strong> System Settings → Shortcuts → Custom Shortcuts
													</li>
													<li>
														<strong>i3/Sway:</strong> Add{" "}
														<code className="text-text-bright">bindsym $mod+n exec yanta --quick</code> to config
													</li>
													<li>
														<strong>Hyprland:</strong> Add{" "}
														<code className="text-text-bright">bind = $mainMod, N, exec, yanta --quick</code> to
														config
													</li>
												</ul>
											</div>
										)}

										{isMac && (
											<div className="space-y-2">
												<div className="text-sm font-medium text-text">Configuration Guide (macOS)</div>
												<ul className="text-xs text-text-dim space-y-1 list-disc list-inside">
													<li>
														<strong>System Settings:</strong> Keyboard → Keyboard Shortcuts → Services
													</li>
													<li>
														<strong>Raycast:</strong> Create a script command with your preferred hotkey
													</li>
													<li>
														<strong>Alfred:</strong> Create a workflow with Terminal command
													</li>
													<li>
														<strong>Hammerspoon:</strong> Use{" "}
														<code className="text-text-bright">hs.hotkey.bind()</code> with os.execute
													</li>
												</ul>
											</div>
										)}
									</div>
								</div>
							)}
						</div>

						{/* Override Shortcuts (when supported) */}
						{onShortcutOverride && (
							<div>
								<Heading as="h3" size="sm" variant="bright" weight="medium" className="mb-2">
									Override Shortcuts
								</Heading>
								<Text size="sm" variant="dim" className="mb-4">
									Customize these shortcuts. Changes take effect immediately.
								</Text>
								<div className="space-y-3">
									{OVERRIDABLE_SHORTCUT_IDS.map(({ id, label }) => {
										const shortcut = shortcuts.find((s) => s.id === id);
										const currentKey = shortcutOverrides[id] ?? shortcut?.currentKey ?? "";
										return (
											<div
												key={id}
												className="flex items-center justify-between gap-4 p-3 rounded border border-border bg-bg-secondary"
											>
												<span className="text-sm text-text">{label}</span>
												<HotkeyInput
													value={currentKey}
													onChange={(key) => onShortcutOverride(id, key)}
													placeholder="Click and press keys..."
												/>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* Application Shortcuts Section */}
						<div>
							<Heading as="h3" size="sm" variant="bright" weight="medium" className="mb-2">
								Application Shortcuts
							</Heading>
							<Text size="sm" variant="dim" className="mb-4">
								Keyboard shortcuts available within YANTA
							</Text>
							<ShortcutsTable shortcuts={shortcuts} />
						</div>
					</div>
				</SettingsSection>
			</div>
		);
	},
);

ShortcutsSection.displayName = "ShortcutsSection";
