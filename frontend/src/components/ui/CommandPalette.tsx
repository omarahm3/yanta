import React, { useState, useEffect, useRef } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { cn } from "../../lib/utils";

export interface CommandOption {
  id: string;
  icon: React.ReactNode;
  text: string;
  hint?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (command: CommandOption) => void;
  commands: CommandOption[];
  placeholder?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onCommandSelect,
  commands,
  placeholder = "Type a command...",
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filteredCommands = commands.filter((command) =>
    command.text.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (optionRefs.current[selectedIndex]) {
      optionRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        if (filteredCommands.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        }
        return;
      }

      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        if (filteredCommands.length > 0) {
          setSelectedIndex((prev) =>
            prev === 0 ? filteredCommands.length - 1 : prev - 1,
          );
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredCommands.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredCommands.length > 0) {
          setSelectedIndex((prev) =>
            prev === 0 ? filteredCommands.length - 1 : prev - 1,
          );
        }
        return;
      }

      if (e.key === "Enter" && filteredCommands[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredCommands[selectedIndex]);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, selectedIndex, filteredCommands]);

  const handleSelect = (command: CommandOption) => {
    command.action();
    onCommandSelect(command);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Combobox value={null} onChange={(value) => value && handleSelect(value)}>
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 bg-black/70"
          onClick={onClose}
        >
          <div
            className="flex min-h-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TransitionChild
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <ComboboxOptions
                static
                className="w-full max-w-lg transform overflow-hidden rounded-lg bg-surface border border-border shadow-xl transition-all"
              >
                <div className="relative">
                  <ComboboxInput
                    ref={inputRef}
                    className="w-full bg-bg border-b border-border px-4 py-3 text-text-bright placeholder-text-dim focus:outline-none focus:ring-0 focus:border-border"
                    placeholder={placeholder}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <kbd className="bg-surface px-2 py-1 text-xs text-text-dim rounded">
                      ESC
                    </kbd>
                  </ComboboxButton>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {filteredCommands.length === 0 && query !== "" ? (
                    <div className="relative cursor-default select-none px-4 py-2 text-text-dim">
                      No commands found.
                    </div>
                  ) : (
                    filteredCommands.map((command, index) => (
                      <ComboboxOption
                        key={command.id}
                        className={cn(
                          "relative cursor-pointer select-none py-2 px-4 flex items-center gap-3",
                          index === selectedIndex
                            ? "bg-border text-text-bright"
                            : "text-text",
                        )}
                        value={command}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div
                          ref={(el) => (optionRefs.current[index] = el)}
                          className="flex items-center gap-3 w-full"
                        >
                          <span className="text-text-dim w-5">
                            {command.icon}
                          </span>
                          <span
                            className={cn(
                              "flex-1",
                              index === selectedIndex && "font-medium",
                            )}
                          >
                            {command.text}
                          </span>
                          {command.hint && (
                            <span className="text-text-dim text-xs">
                              {command.hint}
                            </span>
                          )}
                        </div>
                      </ComboboxOption>
                    ))
                  )}
                </div>
              </ComboboxOptions>
            </TransitionChild>
          </div>
        </div>
      </Combobox>
    </Transition>
  );
};
