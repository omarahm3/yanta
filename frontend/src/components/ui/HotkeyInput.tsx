import type React from "react";
import { useCallback, useState } from "react";
import { cn } from "../../lib/utils";

export interface HotkeyInputProps {
	value: string;
	onChange: (hotkey: string) => void;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
}

/**
 * Modern hotkey input - click to focus, press keys to set, Enter to confirm, Esc to reset.
 */
export const HotkeyInput: React.FC<HotkeyInputProps> = ({
	value,
	onChange,
	disabled = false,
	placeholder = "Click and press keys...",
	className,
}) => {
	const [isCapturing, setIsCapturing] = useState(false);
	const [pendingHotkey, setPendingHotkey] = useState<string | null>(null);

	const buildHotkeyString = useCallback((e: React.KeyboardEvent): string | null => {
		const parts: string[] = [];

		// Add modifiers in consistent order
		if (e.ctrlKey) parts.push("Ctrl");
		if (e.altKey) parts.push("Alt");
		if (e.shiftKey) parts.push("Shift");
		if (e.metaKey) parts.push("Win");

		// Get the actual key (ignore modifier-only presses)
		const key = e.key;
		if (["Control", "Alt", "Shift", "Meta"].includes(key)) {
			return null; // Still pressing modifiers, wait for actual key
		}

		// Normalize key names
		let keyName = key;
		if (key === " ") keyName = "Space";
		else if (key.length === 1) keyName = key.toUpperCase();
		else if (key === "Escape")
			return null; // Esc is for reset, not for hotkey
		else if (key === "Enter") return null; // Enter is for confirm

		parts.push(keyName);

		return parts.join("+");
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();

			// Escape resets to original value
			if (e.key === "Escape") {
				setPendingHotkey(null);
				setIsCapturing(false);
				return;
			}

			// Enter confirms the pending hotkey
			if (e.key === "Enter") {
				if (pendingHotkey) {
					onChange(pendingHotkey);
				}
				setPendingHotkey(null);
				setIsCapturing(false);
				return;
			}

			// Build the hotkey string
			const hotkey = buildHotkeyString(e);
			if (hotkey) {
				setPendingHotkey(hotkey);
			}
		},
		[disabled, pendingHotkey, onChange, buildHotkeyString],
	);

	const handleFocus = useCallback(() => {
		if (!disabled) {
			setIsCapturing(true);
			setPendingHotkey(null);
		}
	}, [disabled]);

	const handleBlur = useCallback(() => {
		setIsCapturing(false);
		setPendingHotkey(null);
	}, []);

	const displayValue = isCapturing ? pendingHotkey || "Press keys..." : value || placeholder;

	return (
		<div
			tabIndex={disabled ? -1 : 0}
			onKeyDown={handleKeyDown}
			onFocus={handleFocus}
			onBlur={handleBlur}
			className={cn(
				"px-3 py-2 rounded border font-mono text-sm cursor-pointer select-none transition-all",
				"focus:outline-none focus:ring-2 focus:ring-accent/50",
				isCapturing
					? "border-accent bg-accent/10 backdrop-blur-sm text-accent"
					: "border-glass-border bg-glass-bg/20 backdrop-blur-sm text-text hover:border-text-dim",
				disabled && "opacity-50 cursor-not-allowed",
				!value && !isCapturing && "text-text-dim",
				className,
			)}
		>
			{displayValue}
			{isCapturing && (
				<span className="ml-2 text-xs text-text-dim">(Enter to save, Esc to cancel)</span>
			)}
		</div>
	);
};
