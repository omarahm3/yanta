import React from "react";
import type { LinuxGraphicsMode } from "@/config/preferences";
import type { DensityMode } from "../shared/stores/appearance.store";
import { useAppearanceStore } from "../shared/stores/appearance.store";
import type { ThemeMode } from "../shared/stores/theme.store";
import { Label, Select, type SelectOption, SettingsSection, Toggle } from "../shared/ui";
import { cn } from "../shared/utils/cn";

const SCALE_OPTIONS: SelectOption[] = [
	{ value: "0.75", label: "Small (75%)" },
	{ value: "0.85", label: "Medium-Small (85%)" },
	{ value: "1.0", label: "Normal (100%)" },
	{ value: "1.15", label: "Medium-Large (115%)" },
	{ value: "1.25", label: "Large (125%)" },
	{ value: "1.5", label: "Extra Large (150%)" },
	{ value: "2.0", label: "Huge (200%)" },
];

const LINUX_GRAPHICS_OPTIONS: SelectOption[] = [
	{ value: "auto", label: "Auto (native-first with fallback)" },
	{ value: "native", label: "Native GPU rendering" },
	{ value: "compat", label: "Compatibility mode" },
	{ value: "software", label: "Software rendering only" },
];

const THEME_CARDS: { value: ThemeMode; label: string; desc: string }[] = [
	{ value: "dark", label: "Dark", desc: "GitHub-dark palette" },
	{ value: "light", label: "Light", desc: "GitHub-light palette" },
	{ value: "system", label: "System", desc: "Follows OS preference" },
];

const DENSITY_OPTIONS: { value: DensityMode; label: string; desc: string }[] = [
	{ value: "compact", label: "Compact", desc: "Tighter spacing" },
	{ value: "normal", label: "Normal", desc: "Default spacing" },
	{ value: "comfortable", label: "Comfortable", desc: "More breathing room" },
];

interface ThemePreviewProps {
	mode: ThemeMode;
}

function ThemePreview({ mode }: ThemePreviewProps) {
	const isDark = mode !== "light";
	const bg = isDark ? "#0d1117" : "#ffffff";
	const surface = isDark ? "#161b22" : "#f6f8fa";
	const border = isDark ? "#30363d" : "#d0d7de";
	const text = isDark ? "#c9d1d9" : "#1f2328";
	const dim = isDark ? "#8b949e" : "#656d76";
	const accent = isDark ? "#58a6ff" : "#0969da";

	return (
		<svg
			width="100%"
			height="52"
			viewBox="0 0 120 52"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<rect width="120" height="52" rx="4" fill={bg} />
			<rect width="28" height="52" fill={surface} />
			<rect x="28" y="0" width="0.5" height="52" fill={border} />
			<rect x="6" y="10" width="16" height="3" rx="1.5" fill={dim} opacity="0.6" />
			<rect x="6" y="18" width="12" height="3" rx="1.5" fill={accent} />
			<rect x="6" y="26" width="14" height="3" rx="1.5" fill={dim} opacity="0.4" />
			<rect x="36" y="10" width="50" height="4" rx="2" fill={text} opacity="0.7" />
			<rect x="36" y="20" width="70" height="3" rx="1.5" fill={dim} opacity="0.5" />
			<rect x="36" y="28" width="60" height="3" rx="1.5" fill={dim} opacity="0.4" />
			<rect x="36" y="36" width="40" height="3" rx="1.5" fill={dim} opacity="0.3" />
		</svg>
	);
}

interface ThemeGalleryProps {
	theme: ThemeMode;
	onThemeChange: (theme: ThemeMode) => void;
}

function ThemeGallery({ theme, onThemeChange }: ThemeGalleryProps) {
	return (
		<div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
			{THEME_CARDS.map(({ value, label, desc }) => {
				const selected = theme === value;
				return (
					<button
						key={value}
						role="radio"
						aria-checked={selected}
						type="button"
						onClick={() => onThemeChange(value)}
						className={cn(
							"flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
							selected
								? "border-accent bg-accent/10 ring-1 ring-accent/40"
								: "border-border bg-surface/50 hover:border-text-dim/40 hover:bg-surface",
						)}
					>
						<div className="overflow-hidden rounded border border-border/60">
							<ThemePreview mode={value} />
						</div>
						<div>
							<div className={cn("text-xs font-medium", selected ? "text-accent" : "text-text")}>
								{label}
							</div>
							<div className="text-[11px] text-text-dim">{desc}</div>
						</div>
					</button>
				);
			})}
		</div>
	);
}

interface DensityPickerProps {
	density: DensityMode;
	onDensityChange: (mode: DensityMode) => void;
}

function DensityPicker({ density, onDensityChange }: DensityPickerProps) {
	return (
		<div className="flex gap-2" role="radiogroup" aria-label="Density">
			{DENSITY_OPTIONS.map(({ value, label, desc }) => {
				const selected = density === value;
				return (
					<button
						key={value}
						role="radio"
						aria-checked={selected}
						type="button"
						onClick={() => onDensityChange(value)}
						className={cn(
							"flex-1 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
							selected
								? "border-accent bg-accent/10 ring-1 ring-accent/40"
								: "border-border bg-surface/50 hover:border-text-dim/40 hover:bg-surface",
						)}
					>
						<div className={cn("text-xs font-medium", selected ? "text-accent" : "text-text")}>
							{label}
						</div>
						<div className="text-[11px] text-text-dim">{desc}</div>
					</button>
				);
			})}
		</div>
	);
}

interface AppearanceSectionProps {
	platform?: string;
	appScale: number;
	onAppScaleChange: (scale: number) => void;
	theme: ThemeMode;
	onThemeChange: (theme: ThemeMode) => void;
	linuxGraphicsMode: LinuxGraphicsMode;
	onLinuxGraphicsModeChange: (mode: LinuxGraphicsMode) => void;
	sidebarVisible: boolean;
	onSidebarVisibleChange: (visible: boolean) => void;
	sidebarLoading?: boolean;
	showFooterHints: boolean;
	onShowFooterHintsChange: (show: boolean) => void;
	footerHintsLoading?: boolean;
	showShortcutTooltips: boolean;
	onShowShortcutTooltipsChange: (show: boolean) => void;
	shortcutTooltipsLoading?: boolean;
	tooltipHintsFeatureEnabled: boolean;
}

export const AppearanceSection = React.forwardRef<HTMLDivElement, AppearanceSectionProps>(
	(
		{
			platform = "",
			appScale,
			onAppScaleChange,
			theme,
			onThemeChange,
			linuxGraphicsMode,
			onLinuxGraphicsModeChange,
			sidebarVisible,
			onSidebarVisibleChange,
			sidebarLoading = false,
			showFooterHints,
			onShowFooterHintsChange,
			footerHintsLoading = false,
			showShortcutTooltips,
			onShowShortcutTooltipsChange,
			shortcutTooltipsLoading = false,
			tooltipHintsFeatureEnabled,
		},
		ref,
	) => {
		const isLinux = platform.includes("linux");
		const reducedEffects = useAppearanceStore((s) => s.reducedEffects);
		const setReducedEffects = useAppearanceStore((s) => s.setReducedEffects);
		const densityMode = useAppearanceStore((s) => s.densityMode);
		const setDensityMode = useAppearanceStore((s) => s.setDensityMode);

		const formatScaleValue = (scale: number): string => {
			const matchingOption = SCALE_OPTIONS.find(
				(opt) => Math.abs(parseFloat(opt.value) - scale) < 0.001,
			);
			return matchingOption ? matchingOption.value : scale.toString();
		};

		return (
			<div ref={ref}>
				<SettingsSection title="Appearance" subtitle="Customize the look and feel of the application">
					<div className="space-y-6">
						<div className="space-y-2">
							<Label variant="uppercase">Theme</Label>
							<ThemeGallery theme={theme} onThemeChange={onThemeChange} />
						</div>

						<div className="space-y-2">
							<Label variant="uppercase">Density</Label>
							<DensityPicker density={densityMode} onDensityChange={setDensityMode} />
							<div className="text-xs text-text-dim">
								Controls spacing throughout the interface. Takes effect immediately.
							</div>
						</div>

						<div className="space-y-2">
							<Label variant="uppercase">Interface Scale</Label>
							<Select
								value={formatScaleValue(appScale)}
								onChange={(value) => onAppScaleChange(parseFloat(value))}
								options={SCALE_OPTIONS}
							/>
							<div className="text-xs text-text-dim">
								Adjust the size of text and UI elements throughout the app. Current scale:{" "}
								<span className="font-mono text-accent">{Math.round(appScale * 100)}%</span>
							</div>
						</div>

						<div className="space-y-3 pt-2 border-t border-border/50">
							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm text-text">Show Sidebar</div>
									<div className="text-xs text-text-dim">
										Display the navigation sidebar. Use Ctrl+B to toggle.
									</div>
								</div>
								<Toggle
									checked={sidebarVisible}
									onChange={onSidebarVisibleChange}
									disabled={sidebarLoading}
								/>
							</div>

							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm text-text">Show Keyboard Hints</div>
									<div className="text-xs text-text-dim">
										Display context-aware keyboard shortcuts at the bottom of the screen.
									</div>
								</div>
								<Toggle
									checked={showFooterHints}
									onChange={onShowFooterHintsChange}
									disabled={footerHintsLoading}
								/>
							</div>

							{tooltipHintsFeatureEnabled && (
								<div className="flex items-center justify-between">
									<div>
										<div className="text-sm text-text">Show Shortcut Tooltips</div>
										<div className="text-xs text-text-dim">
											Display helpful tooltips showing keyboard shortcuts when hovering over buttons.
										</div>
									</div>
									<Toggle
										checked={showShortcutTooltips}
										onChange={onShowShortcutTooltipsChange}
										disabled={shortcutTooltipsLoading}
									/>
								</div>
							)}

							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm text-text">Reduce Visual Effects</div>
									<div className="text-xs text-text-dim">
										Disable glass/blur effects. Improves performance on low-end hardware and some Linux
										compositors.
									</div>
								</div>
								<Toggle checked={reducedEffects} onChange={setReducedEffects} />
							</div>
						</div>

						{isLinux && (
							<div className="space-y-2 pt-4 border-t border-border">
								<Label variant="uppercase">Linux Graphics Mode</Label>
								<Select
									value={linuxGraphicsMode}
									onChange={(value) => onLinuxGraphicsModeChange(value as LinuxGraphicsMode)}
									options={LINUX_GRAPHICS_OPTIONS}
								/>
								<div className="text-xs text-text-dim">
									Controls GPU/compatibility behavior on Linux. Restart required after changes.
								</div>
							</div>
						)}
					</div>
				</SettingsSection>
			</div>
		);
	},
);

AppearanceSection.displayName = "AppearanceSection";
