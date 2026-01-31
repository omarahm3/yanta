import type React from "react";
import { cn } from "../../lib/utils";
import { formatHotkey } from "../../types/globalHotkeys";
import { Label } from "./Label";
import { Select, type SelectOption } from "./Select";
import { Toggle } from "./Toggle";

export interface HotkeyEditorProps {
	modifiers: string[];
	keyName: string;
	enabled: boolean;
	onModifiersChange: (mods: string[]) => void;
	onKeyChange: (key: string) => void;
	onEnabledChange: (enabled: boolean) => void;
	availableModifiers: string[];
	availableKeys: string[];
	error?: string;
	disabled?: boolean;
}

export const HotkeyEditor: React.FC<HotkeyEditorProps> = ({
	modifiers,
	keyName,
	enabled,
	onModifiersChange,
	onKeyChange,
	onEnabledChange,
	availableModifiers,
	availableKeys,
	error,
	disabled = false,
}) => {
	const keyOptions: SelectOption[] = availableKeys.map((k) => ({
		value: k,
		label: k,
	}));

	const handleModifierToggle = (mod: string) => {
		if (modifiers.includes(mod)) {
			onModifiersChange(modifiers.filter((m) => m !== mod));
		} else {
			onModifiersChange([...modifiers, mod]);
		}
	};

	const currentHotkey = formatHotkey(modifiers, keyName);

	return (
		<div className="space-y-3">
			{/* Enable/Disable toggle */}
			<div className="flex items-center justify-between">
				<div>
					<div className="text-sm text-text">Enable hotkey</div>
					<div className="text-xs text-text-dim">
						Current: <span className="font-mono text-text-bright">{currentHotkey}</span>
					</div>
				</div>
				<Toggle checked={enabled} onChange={onEnabledChange} disabled={disabled} />
			</div>

			{/* Hotkey configuration (only shown when enabled) */}
			{enabled && (
				<div
					className={cn(
						"p-3 rounded border border-border bg-bg-secondary space-y-3",
						disabled && "opacity-50",
					)}
				>
					{/* Modifiers selection */}
					<div>
						<Label className="text-xs text-text-dim mb-2 block">Modifiers</Label>
						<div className="flex flex-wrap gap-2">
							{availableModifiers.map((mod) => (
								<button
									key={mod}
									type="button"
									onClick={() => handleModifierToggle(mod)}
									disabled={disabled}
									className={cn(
										"px-3 py-1 text-sm rounded border transition-colors",
										modifiers.includes(mod)
											? "bg-accent-primary border-accent-primary text-text-bright"
											: "bg-bg-tertiary border-border text-text hover:border-text-dim",
										disabled && "cursor-not-allowed opacity-50",
									)}
								>
									{mod}
								</button>
							))}
						</div>
					</div>

					{/* Key selection */}
					<div>
						<Label className="text-xs text-text-dim mb-2 block">Key</Label>
						<Select
							value={keyName}
							onChange={onKeyChange}
							options={keyOptions}
							disabled={disabled}
							className="w-32"
						/>
					</div>

					{/* Preview */}
					<div className="pt-2 border-t border-border">
						<div className="text-xs text-text-dim">
							Hotkey: <span className="font-mono text-text-bright">{currentHotkey}</span>
						</div>
					</div>
				</div>
			)}

			{/* Error message */}
			{error && (
				<div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-800">
					{error}
				</div>
			)}
		</div>
	);
};
