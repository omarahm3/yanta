import { RotateCcw, Search } from "lucide-react";
import React from "react";
import { useReducedEffects } from "../shared/stores/appearance.store";
import type { GlobalHotkeyConfig } from "../shared/types";
import {
	Button,
	Heading,
	HotkeyEditor,
	HotkeyInput,
	Input,
	SettingsSection,
	type Shortcut,
	Text,
} from "../shared/ui";

/** Shortcut entry for conflict detection. */
export interface ShortcutEntry {
	id: string;
	action: string;
	defaultKey: string;
	currentKey: string;
}

/** Conflict info returned by detectShortcutConflict. */
export interface ShortcutConflict {
	id: string;
	action: string;
}

/**
 * Detect if a shortcut key conflicts with another action.
 * Returns the conflicting shortcut info, or null if no conflict.
 */
export function detectShortcutConflict(
	currentId: string,
	key: string,
	shortcuts: ShortcutEntry[],
): ShortcutConflict | null {
	if (!key) return null;
	const normalizedKey = key.toLowerCase();
	for (const shortcut of shortcuts) {
		if (shortcut.id === currentId) continue;
		if (shortcut.currentKey.toLowerCase() === normalizedKey) {
			return { id: shortcut.id, action: shortcut.action };
		}
	}
	return null;
}

/** Group shortcuts by their category (prefix before the dot). */
export function groupShortcutsByCategory(shortcuts: Shortcut[]): Record<string, Shortcut[]> {
	const groups: Record<string, Shortcut[]> = {};
	for (const shortcut of shortcuts) {
		const dot = shortcut.id.indexOf(".");
		const group = dot === -1 ? "other" : shortcut.id.slice(0, dot);
		if (!groups[group]) groups[group] = [];
		groups[group].push(shortcut);
	}
	return groups;
}

/** Filter shortcuts by search query (matches action or key). */
export function filterShortcutsByQuery(shortcuts: Shortcut[], query: string): Shortcut[] {
	if (!query) return shortcuts;
	const q = query.toLowerCase();
	return shortcuts.filter(
		(s) => s.action.toLowerCase().includes(q) || s.currentKey.toLowerCase().includes(q),
	);
}

/** Human-readable labels for shortcut groups. */
const GROUP_LABELS: Record<string, string> = {
	global: "Global",
	sidebar: "Sidebar",
	document: "Document",
	dashboard: "Dashboard",
	journal: "Journal",
	projects: "Projects",
	quickCapture: "Quick Capture",
	settings: "Settings",
	commandLine: "Command Line",
	search: "Search",
	pane: "Pane",
};

interface ShortcutsSectionProps {
	platform: string;
	hotkeyConfig: GlobalHotkeyConfig;
	onHotkeyConfigChange: (config: GlobalHotkeyConfig) => void;
	hotkeyError?: string;
	shortcuts: Shortcut[];
	/** Override shortcuts (from preferences). Key: "group.key", value: key combo e.g. "mod+K" */
	shortcutOverrides?: Record<string, string>;
	onShortcutOverride?: (id: string, newKey: string) => void;
	onShortcutReset?: (id: string) => void;
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
			onShortcutReset,
		},
		ref,
	) => {
		const reducedEffects = useReducedEffects();
		const [showShortcutReference, setShowShortcutReference] = React.useState(!reducedEffects);
		const [searchQuery, setSearchQuery] = React.useState("");
		React.useEffect(() => {
			if (reducedEffects) {
				setShowShortcutReference(false);
			}
		}, [reducedEffects]);
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

		// Filter and group shortcuts for the editable table
		const filteredShortcuts = filterShortcutsByQuery(shortcuts, searchQuery);
		const groupedShortcuts = groupShortcutsByCategory(filteredShortcuts);
		const groupOrder = [
			"global",
			"sidebar",
			"document",
			"dashboard",
			"journal",
			"projects",
			"quickCapture",
			"settings",
			"commandLine",
			"search",
			"pane",
		];

		return (
			<div ref={ref}>
				<SettingsSection
					id="shortcuts"
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
									<div className="rounded-lg bg-bg-dark p-4">
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
									<div className="rounded-lg bg-bg-dark p-3">
										<div className="text-sm text-text">Restore Window</div>
										<div className="text-xs text-text-dim">
											Press <span className="font-mono text-text-bright">Ctrl+Shift+Y</span> to show and focus
											the main YANTA window when it's hidden.
										</div>
									</div>
								</div>
							)}

							{(isLinux || isMac) && (
								<div className="rounded-lg bg-bg-dark p-4">
									<div className="space-y-3">
										<Text size="sm" variant="dim">
											Global hotkeys require platform-specific configuration on {isMac ? "macOS" : "Linux"}.
										</Text>

										<div className="rounded-md bg-bg p-3">
											<div className="text-sm font-medium text-text mb-2">Quick Capture Command</div>
											<div className="font-mono text-sm text-accent bg-bg-dark p-2 rounded">yanta --quick</div>
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

						{/* All Shortcuts - Grouped, Searchable, Editable */}
						<div>
							<div className="mb-4 flex items-center justify-between gap-3">
								<Heading as="h3" size="sm" variant="bright" weight="medium">
									All Shortcuts
								</Heading>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowShortcutReference((v) => !v)}
									className="text-xs"
								>
									{showShortcutReference ? "Hide table" : "Show table"}
								</Button>
							</div>

							{showShortcutReference && (
								<>
									{/* Search box */}
									{onShortcutOverride && (
										<div className="relative mb-4">
											<Search
												className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim"
												aria-hidden="true"
											/>
											<Input
												variant="default"
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												placeholder="Search shortcuts..."
												aria-label="Search shortcuts"
												className="pl-9"
											/>
										</div>
									)}

									{/* Grouped shortcuts list */}
									<div className="space-y-6">
										{groupOrder.map((group) => {
											const groupShortcuts = groupedShortcuts[group];
											if (!groupShortcuts || groupShortcuts.length === 0) return null;
											const groupLabel = GROUP_LABELS[group] || group;
											return (
												<div key={group}>
													<Heading as="h4" size="xs" variant="bright" weight="medium" className="mb-2">
														{groupLabel}
													</Heading>
													<div className="space-y-2">
														{groupShortcuts.map((shortcut) => {
															const isOverridden = shortcut.id in shortcutOverrides;
															const currentKey = shortcutOverrides[shortcut.id] ?? shortcut.currentKey ?? "";
															const conflict = detectShortcutConflict(shortcut.id, currentKey, shortcuts);
															return (
																<div
																	key={shortcut.id}
																	className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
																>
																	<div className="flex-1">
																		<span className="text-sm text-text">{shortcut.action}</span>
																		{conflict && (
																			<div className="mt-1 text-xs text-red-500">
																				Conflict: already assigned to "{conflict.action}"
																			</div>
																		)}
																	</div>
																	<div className="flex items-center gap-2">
																		{onShortcutOverride ? (
																			<HotkeyInput
																				value={currentKey}
																				onChange={(key) => onShortcutOverride(shortcut.id, key)}
																				placeholder="Click and press keys..."
																			/>
																		) : (
																			<span className="font-mono text-sm text-text-bright">{currentKey}</span>
																		)}
																		{isOverridden && onShortcutReset && (
																			<Button
																				variant="ghost"
																				size="sm"
																				onClick={() => onShortcutReset(shortcut.id)}
																				title="Reset to default"
																				className="px-2"
																			>
																				<RotateCcw className="h-4 w-4" />
																			</Button>
																		)}
																	</div>
																</div>
															);
														})}
													</div>
												</div>
											);
										})}
										{filteredShortcuts.length === 0 && searchQuery && (
											<div className="rounded border border-border p-4 text-center text-sm text-text-dim">
												No shortcuts match "{searchQuery}"
											</div>
										)}
									</div>
								</>
							)}

							{!showShortcutReference && (
								<div className="rounded border border-border p-3 text-xs text-text-dim">
									Shortcut reference is collapsed to reduce render load on this page.
								</div>
							)}
						</div>
					</div>
				</SettingsSection>
			</div>
		);
	},
);

ShortcutsSection.displayName = "ShortcutsSection";
