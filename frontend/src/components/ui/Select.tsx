import React from "react";
import { cn } from "../../lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: "default" | "ghost";
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const baseClasses = "select";
    const variantClasses = {
      default: "bg-surface border border-border rounded-md px-3 py-2",
      ghost: "bg-transparent border-none",
    };

    return (
      <select
        className={cn(baseClasses, variantClasses[variant], className)}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
