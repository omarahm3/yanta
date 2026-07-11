import React from "react";
import type { PreferencesEditorOverrides } from "@/config/preferences";
import { Label, Select, type SelectOption, SettingsSection, Toggle } from "../shared/ui";

const FONT_SIZE_OPTIONS: SelectOption[] = [
	{ value: "12", label: "12px" },
	{ value: "13", label: "13px" },
	{ value: "14", label: "14px (Default)" },
	{ value: "15", label: "15px" },
	{ value: "16", label: "16px" },
	{ value: "18", label: "18px" },
	{ value: "20", label: "20px" },
];

const FONT_FAMILY_OPTIONS: SelectOption[] = [
	{ value: "Inter", label: "Inter (Default)" },
	{ value: "Georgia", label: "Georgia (Serif)" },
	{ value: "JetBrains Mono", label: "JetBrains Mono (Monospace)" },
	{ value: "Merriweather", label: "Merriweather (Serif)" },
	{ value: "Open Sans", label: "Open Sans" },
	{ value: "Roboto", label: "Roboto" },
	{ value: "Source Sans Pro", label: "Source Sans Pro" },
];

const LINE_WIDTH_OPTIONS: SelectOption[] = [
	{ value: "600", label: "Narrow (600px)" },
	{ value: "720", label: "Medium (720px)" },
	{ value: "840", label: "Wide (840px)" },
	{ value: "960", label: "Extra Wide (960px)" },
	{ value: "0", label: "Full Width" },
];

interface EditorSectionProps {
	editorPrefs: PreferencesEditorOverrides;
	onEditorPrefsChange: (prefs: PreferencesEditorOverrides) => void;
}

export const EditorSection = React.forwardRef<HTMLDivElement, EditorSectionProps>(
	({ editorPrefs, onEditorPrefsChange }, ref) => {
		const fontSize = editorPrefs.fontSize ?? 14;
		const fontFamily = editorPrefs.fontFamily ?? "Inter";
		const lineWidth = editorPrefs.lineWidth ?? 720;
		const spellcheck = editorPrefs.spellcheck ?? true;

		return (
			<div ref={ref}>
				<SettingsSection
					id="editor"
					title="Editor"
					subtitle="Customize the document editor appearance and behavior"
				>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label variant="uppercase">Font Size</Label>
							<Select
								value={fontSize.toString()}
								onChange={(value) =>
									onEditorPrefsChange({ ...editorPrefs, fontSize: Number.parseInt(value, 10) })
								}
								options={FONT_SIZE_OPTIONS}
							/>
							<div className="text-xs text-text-dim">Adjust the base font size for document editing.</div>
						</div>

						<div className="space-y-2">
							<Label variant="uppercase">Font Family</Label>
							<Select
								value={fontFamily}
								onChange={(value) => onEditorPrefsChange({ ...editorPrefs, fontFamily: value })}
								options={FONT_FAMILY_OPTIONS}
							/>
							<div className="text-xs text-text-dim">Choose the font family for document text.</div>
						</div>

						<div className="space-y-2">
							<Label variant="uppercase">Line Width</Label>
							<Select
								value={lineWidth.toString()}
								onChange={(value) =>
									onEditorPrefsChange({ ...editorPrefs, lineWidth: Number.parseInt(value, 10) })
								}
								options={LINE_WIDTH_OPTIONS}
							/>
							<div className="text-xs text-text-dim">
								Control the maximum width of text lines for comfortable reading.
							</div>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-text">Spellcheck</div>
								<div className="text-xs text-text-dim">Enable browser spellchecking in the editor.</div>
							</div>
							<Toggle
								checked={spellcheck}
								onChange={(checked) => onEditorPrefsChange({ ...editorPrefs, spellcheck: checked })}
							/>
						</div>
					</div>
				</SettingsSection>
			</div>
		);
	},
);

EditorSection.displayName = "EditorSection";
