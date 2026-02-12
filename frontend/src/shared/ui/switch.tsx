import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "../utils/cn";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"peer inline-flex h-5 w-9 shrink-0 items-center rounded-full shadow-xs transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50",
				"data-[state=checked]:bg-green data-[state=checked]:ring-2 data-[state=checked]:ring-accent data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-bg",
				"data-[state=unchecked]:bg-glass-bg/40 data-[state=unchecked]:border data-[state=unchecked]:border-glass-border",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"bg-white pointer-events-none block size-4 rounded-full ring-0 shadow-lg transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
