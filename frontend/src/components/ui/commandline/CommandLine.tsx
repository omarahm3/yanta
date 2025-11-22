import type React from "react";
import { type ForwardedRef, forwardRef } from "react";
import { Input } from "../Input";
import type { CommandLineProps } from "./types";

const CommandLineComponent = (
	{
		context,
		placeholder = "type command or press / for help",
		value,
		onChange,
		onSubmit,
	}: CommandLineProps,
	ref: ForwardedRef<HTMLInputElement>,
) => {
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && value.trim()) {
			onSubmit(value.trim());
		}
	};

	const prompt = `${context} >`;

	return (
		<div className="flex border-t bg-surface border-border">
			<div className="flex items-center px-4 py-3 font-semibold border-r text-text-dim bg-bg border-border">
				{prompt}
			</div>
			<Input
				ref={ref}
				type="text"
				variant="ghost"
				className="flex-1 px-4 py-3 font-mono text-sm bg-transparent border-none outline-none text-text-bright rounded-none"
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
			/>
		</div>
	);
};

CommandLineComponent.displayName = "CommandLine";

export const CommandLine = forwardRef(CommandLineComponent);
