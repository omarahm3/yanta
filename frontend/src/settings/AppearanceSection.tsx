import React from "react";
import type { LinuxGraphicsMode } from "../config/preferences";
import { useAppearanceStore } from "../shared/stores/appearance.store";
import { Label, Select, type SelectOption, SettingsSection, Toggle } from "../shared/ui";

interface AppearanceSectionProps {
	platform?: string;
	appScale: number;
	onAppScaleChange: (scale: number) => void;
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

		const scaleOptions: SelectOption[] = [
			{ value: "0.75", label: "Small (75%)" },
			{ value: "0.85", label: "Medium-Small (85%)" },
			{ value: "1.0", label: "Normal (100%)" },
			{ value: "1.15", label: "Medium-Large (115%)" },
			{ value: "1.25", label: "Large (125%)" },
			{ value: "1.5", label: "Extra Large (150%)" },
			{ value: "2.0", label: "Huge (200%)" },
		];

		const formatScaleValue = (scale: number): string => {
			const matchingOption = scaleOptions.find(
				(opt) => Math.abs(parseFloat(opt.value) - scale) < 0.001,
			);
			return matchingOption ? matchingOption.value : scale.toString();
		};

		const linuxGraphicsOptions: SelectOption[] = [
			{ value: "auto", label: "Auto (native-first with fallback)" },
			{ value: "native", label: "Native GPU rendering" },
			{ value: "compat", label: "Compatibility mode" },
			{ value: "software", label: "Software rendering only" },
		];

		return (
			<div ref={ref}>
				<SettingsSection title="Appearance" subtitle="Customize the look and feel of the application">
					<div className="space-y-4">
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

						<div className="space-y-2">
							<Label variant="uppercase">Interface Scale</Label>
							<Select
								value={formatScaleValue(appScale)}
								onChange={(value) => onAppScaleChange(parseFloat(value))}
								options={scaleOptions}
							/>
							<div className="text-xs text-text-dim">
								Adjust the size of text and UI elements throughout the app. Current scale:{" "}
								<span className="font-mono text-accent">{Math.round(appScale * 100)}%</span>
							</div>
						</div>

						{isLinux && (
							<div className="space-y-2 pt-4 border-t border-border">
								<Label variant="uppercase">Linux Graphics Mode</Label>
								<Select
									value={linuxGraphicsMode}
									onChange={(value) => onLinuxGraphicsModeChange(value as LinuxGraphicsMode)}
									options={linuxGraphicsOptions}
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
