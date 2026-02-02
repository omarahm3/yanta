import React, { type ForwardedRef, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Input } from "./Input";

/** Detects if the current platform is macOS */
function isMacOS(): boolean {
	if (typeof navigator === "undefined") {
		return false;
	}
	return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

export interface QuickCreateInputProps {
	/** The project alias to display in the placeholder (e.g., "@project") */
	projectAlias: string;
	/** Callback when user presses Enter to create a document */
	onCreateDocument: (title: string) => void;
	/** Callback when user presses Shift+Enter to create a journal entry */
	onCreateJournalEntry: (content: string) => void;
	/** Whether the input is disabled */
	disabled?: boolean;
	/** Current input value (controlled) */
	value?: string;
	/** Callback when input value changes */
	onChange?: (value: string) => void;
	/** Additional class names */
	className?: string;
	/** Callback when empty input hint should be shown (optional, if not provided hint is shown inline) */
	onEmptyHint?: () => void;
}

const QuickCreateInputComponent = (
	{
		projectAlias,
		onCreateDocument,
		onCreateJournalEntry,
		disabled = false,
		value: controlledValue,
		onChange,
		className,
		onEmptyHint,
	}: QuickCreateInputProps,
	ref: ForwardedRef<HTMLInputElement>,
) => {
	const internalRef = useRef<HTMLInputElement>(null);
	const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

	// Handle internal state if uncontrolled
	const [internalValue, setInternalValue] = useState("");
	const value = controlledValue !== undefined ? controlledValue : internalValue;
	const setValue = useCallback(
		(newValue: string) => {
			if (onChange) {
				onChange(newValue);
			} else {
				setInternalValue(newValue);
			}
		},
		[onChange],
	);

	// Track focus state for visual feedback
	const [isFocused, setIsFocused] = useState(false);

	// Track empty hint state
	const [showEmptyHint, setShowEmptyHint] = useState(false);

	// Platform detection for Shift key symbol
	const isMac = useMemo(() => isMacOS(), []);
	const shiftSymbol = isMac ? "⇧" : "Shift+";

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (disabled) return;

			const trimmedValue = value.trim();

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (trimmedValue) {
					onCreateDocument(trimmedValue);
					setValue("");
					setShowEmptyHint(false);
				} else {
					// Show gentle hint for empty input
					if (onEmptyHint) {
						onEmptyHint();
					} else {
						setShowEmptyHint(true);
						// Auto-hide hint after 3 seconds
						setTimeout(() => setShowEmptyHint(false), 3000);
					}
				}
			} else if (e.key === "Enter" && e.shiftKey) {
				e.preventDefault();
				if (trimmedValue) {
					onCreateJournalEntry(trimmedValue);
					setValue("");
					setShowEmptyHint(false);
				} else {
					// Show gentle hint for empty input
					if (onEmptyHint) {
						onEmptyHint();
					} else {
						setShowEmptyHint(true);
						// Auto-hide hint after 3 seconds
						setTimeout(() => setShowEmptyHint(false), 3000);
					}
				}
			}
		},
		[disabled, value, onCreateDocument, onCreateJournalEntry, setValue, onEmptyHint],
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValue(e.target.value);
			// Clear empty hint when user starts typing
			if (e.target.value.trim()) {
				setShowEmptyHint(false);
			}
		},
		[setValue],
	);

	const handleFocus = useCallback(() => {
		setIsFocused(true);
	}, []);

	const handleBlur = useCallback(() => {
		setIsFocused(false);
		setShowEmptyHint(false);
	}, []);

	// Global keyboard shortcut: Ctrl+D to focus
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === "d") {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};

		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [inputRef]);

	const prompt = `@${projectAlias} >`;
	const placeholder = showEmptyHint ? "Type a title to create a document" : "Type to create...";

	return (
		<div
			className={cn(
				"flex items-center border-t bg-surface border-border transition-colors duration-200",
				isFocused && "border-t-accent",
				disabled && "opacity-50 pointer-events-none",
				className,
			)}
		>
			{/* Project prefix */}
			<div
				className={cn(
					"flex items-center px-4 py-3 font-mono font-semibold border-r text-text-dim bg-bg border-border whitespace-nowrap transition-colors duration-200",
					isFocused && "text-accent",
				)}
			>
				{prompt}
			</div>

			{/* Input field */}
			<Input
				ref={inputRef}
				type="text"
				variant="ghost"
				className={cn(
					"flex-1 px-4 py-3 font-mono text-sm bg-transparent border-none outline-none text-text-bright rounded-none focus:ring-0 focus:ring-offset-0",
					showEmptyHint && "placeholder:text-yellow/70",
				)}
				placeholder={placeholder}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onFocus={handleFocus}
				onBlur={handleBlur}
				disabled={disabled}
				aria-label="Quick create input"
			/>

			{/* Hint badges */}
			<div className="flex items-center gap-2 px-4 py-3 border-l border-border bg-bg">
				<HintBadge keyText="Enter" label="doc" />
				<HintBadge keyText={`${shiftSymbol}Enter`} label="journal" />
			</div>
		</div>
	);
};

QuickCreateInputComponent.displayName = "QuickCreateInput";

/** Individual hint badge component */
interface HintBadgeProps {
	keyText: string;
	label: string;
}

const HintBadge: React.FC<HintBadgeProps> = ({ keyText, label }) => (
	<div className="flex items-center gap-1 text-xs text-text-dim">
		<kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-border text-text-dim">
			{keyText}
		</kbd>
		<span>{label}</span>
	</div>
);

export const QuickCreateInput = forwardRef(QuickCreateInputComponent);
