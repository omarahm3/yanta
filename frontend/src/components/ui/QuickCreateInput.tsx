import React, { type ForwardedRef, forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Input } from "./Input";

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

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (disabled) return;

			const trimmedValue = value.trim();

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (trimmedValue) {
					onCreateDocument(trimmedValue);
					setValue("");
				}
			} else if (e.key === "Enter" && e.shiftKey) {
				e.preventDefault();
				if (trimmedValue) {
					onCreateJournalEntry(trimmedValue);
					setValue("");
				}
			}
		},
		[disabled, value, onCreateDocument, onCreateJournalEntry, setValue],
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValue(e.target.value);
		},
		[setValue],
	);

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
	const placeholder = "Type to create...";

	return (
		<div
			className={cn(
				"flex items-center border-t bg-surface border-border",
				disabled && "opacity-50 pointer-events-none",
				className,
			)}
		>
			{/* Project prefix */}
			<div className="flex items-center px-4 py-3 font-mono font-semibold border-r text-text-dim bg-bg border-border whitespace-nowrap">
				{prompt}
			</div>

			{/* Input field */}
			<Input
				ref={inputRef}
				type="text"
				variant="ghost"
				className="flex-1 px-4 py-3 font-mono text-sm bg-transparent border-none outline-none text-text-bright rounded-none focus:ring-0 focus:ring-offset-0"
				placeholder={placeholder}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				aria-label="Quick create input"
			/>

			{/* Hint badges */}
			<div className="flex items-center gap-2 px-4 py-3 border-l border-border bg-bg">
				<HintBadge keyText="Enter" label="doc" />
				<HintBadge keyText="⇧Enter" label="journal" />
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
