import React from "react";
import { Label, Select, type SelectOption, SettingsSection } from "../../components/ui";

interface AppearanceSectionProps {
	appScale: number;
	onAppScaleChange: (scale: number) => void;
}

export const AppearanceSection = React.forwardRef<HTMLDivElement, AppearanceSectionProps>(
	({ appScale, onAppScaleChange }, ref) => {
		const scaleOptions: SelectOption[] = [
			{ value: "0.75", label: "Small (75%)" },
			{ value: "0.85", label: "Medium-Small (85%)" },
			{ value: "1.0", label: "Normal (100%)" },
			{ value: "1.15", label: "Medium-Large (115%)" },
			{ value: "1.25", label: "Large (125%)" },
			{ value: "1.5", label: "Extra Large (150%)" },
			{ value: "2.0", label: "Huge (200%)" },
		];

		return (
			<div ref={ref}>
				<SettingsSection title="Appearance" subtitle="Customize the look and feel of the application">
					<div className="space-y-4">
						<div className="space-y-2">
							<Label variant="uppercase">Interface Scale</Label>
							<Select
								value={appScale.toString()}
								onChange={(value) => onAppScaleChange(parseFloat(value))}
								options={scaleOptions}
							/>
							<div className="text-xs text-text-dim">
								Adjust the size of text and UI elements throughout the app. Current scale:{" "}
								<span className="font-mono text-accent">{Math.round(appScale * 100)}%</span>
							</div>
						</div>
					</div>
				</SettingsSection>
			</div>
		);
	},
);

AppearanceSection.displayName = "AppearanceSection";
