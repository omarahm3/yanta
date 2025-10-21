import React, { forwardRef, ForwardedRef } from "react";
import { CommandLineProps } from "./types";

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
      <input
        ref={ref}
        type="text"
        className="flex-1 px-4 py-3 font-mono text-sm bg-transparent border-none outline-none text-text-bright"
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
