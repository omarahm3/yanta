import type React from "react";
import { HotkeyInput } from "./HotkeyInput";
import { Toggle } from "./Toggle";

export interface HotkeyEditorProps {
	value: string;
	enabled: boolean;
	onValueChange: (hotkey: string) => void;
	onEnabledChange: (enabled: boolean) => void;
	error?: string;
	disabled?: boolean;
}

/**
 * Hotkey editor with enable toggle and modern key capture input.
 * Click the input, press your desired hotkey, Enter to save, Esc to cancel.
 */
export const HotkeyEditor: React.FC<HotkeyEditorProps> = ({
	value,
	enabled,
	onValueChange,
	onEnabledChange,
	error,
	disabled = false,
}) => {
	return (
		<div className="space-y-3">
			{/* Enable/Disable toggle */}
			<div className="flex items-center justify-between">
				<div>
					<div className="text-sm text-text">Enable hotkey</div>
					{value && (
						<div className="text-xs text-text-dim">
							Current: <span className="font-mono text-text-bright">{value}</span>
						</div>
					)}
				</div>
				<Toggle checked={enabled} onChange={onEnabledChange} disabled={disabled} />
			</div>

			{/* Hotkey input (only shown when enabled) */}
			{enabled && (
				<HotkeyInput
					value={value}
					onChange={onValueChange}
					disabled={disabled}
					placeholder="Click and press keys..."
				/>
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
