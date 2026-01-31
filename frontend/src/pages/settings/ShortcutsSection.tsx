import React from "react";
import {
	Heading,
	HotkeyEditor,
	SettingsSection,
	type Shortcut,
	ShortcutsTable,
	Text,
} from "../../components/ui";
import type { GlobalHotkeyConfig } from "../../types";

interface ShortcutsSectionProps {
	platform: string;
	hotkeyConfig: GlobalHotkeyConfig;
	availableKeys: string[];
	availableModifiers: string[];
	onHotkeyConfigChange: (config: GlobalHotkeyConfig) => void;
	hotkeyError?: string;
	shortcuts: Shortcut[];
}

export const ShortcutsSection = React.forwardRef<HTMLDivElement, ShortcutsSectionProps>(
	(
		{
			platform,
			hotkeyConfig,
			availableKeys,
			availableModifiers,
			onHotkeyConfigChange,
			hotkeyError,
			shortcuts,
		},
		ref,
	) => {
		const isWindows = platform === "windows";
		const isLinux = platform === "linux";
		const isMac = platform === "darwin";

		const handleModifiersChange = (mods: string[]) => {
			onHotkeyConfigChange({
				...hotkeyConfig,
				quickCaptureModifiers: mods,
			});
		};

		const handleKeyChange = (key: string) => {
			onHotkeyConfigChange({
				...hotkeyConfig,
				quickCaptureKey: key,
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
											<div className="text-xs text-text-dim">Open the Quick Capture window from anywhere</div>
										</div>
										<HotkeyEditor
											modifiers={hotkeyConfig.quickCaptureModifiers}
											keyName={hotkeyConfig.quickCaptureKey}
											enabled={hotkeyConfig.quickCaptureEnabled}
											onModifiersChange={handleModifiersChange}
											onKeyChange={handleKeyChange}
											onEnabledChange={handleEnabledChange}
											availableModifiers={availableModifiers}
											availableKeys={availableKeys}
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
