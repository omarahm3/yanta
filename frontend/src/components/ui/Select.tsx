import React from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import { RiArrowDownSLine, RiCheckLine } from "react-icons/ri";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  variant?: "default" | "ghost";
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value,
      onChange,
      options,
      disabled = false,
      className,
      variant = "default",
    },
    ref,
  ) => {
    const selectedOption = options.find((opt) => opt.value === value);

    const baseClasses = "relative w-full";
    const buttonClasses = {
      default:
        "w-full px-3 py-2 text-sm border rounded bg-bg border-border text-text focus:outline-none focus:border-accent",
      ghost: "bg-transparent border-none",
    };

    return (
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        {({ open }) => (
          <div className={cn(baseClasses, className)}>
            <ListboxButton
              ref={ref}
              className={cn(
                buttonClasses[variant],
                "flex items-center justify-between",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="block truncate">
                {selectedOption?.label || "Select..."}
              </span>
              <RiArrowDownSLine
                className={cn(
                  "w-4 h-4 text-text-dim transition-transform",
                  open && "transform rotate-180",
                )}
              />
            </ListboxButton>
            <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-border bg-bg py-1 shadow-lg focus:outline-none">
              {options.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className={({ active, selected }) =>
                    cn(
                      "relative cursor-pointer select-none py-2 pl-10 pr-4 text-sm",
                      active ? "bg-bg-secondary text-text-bright" : "text-text",
                      selected && "font-medium",
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className="block truncate">{option.label}</span>
                      {selected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-accent">
                          <RiCheckLine className="w-4 h-4" />
                        </span>
                      )}
                    </>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        )}
      </Listbox>
    );
  },
);

Select.displayName = "Select";
