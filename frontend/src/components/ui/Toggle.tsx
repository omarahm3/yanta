import type React from "react";
import { Switch } from "./switch";

export interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
	checked,
	onChange,
	disabled = false,
	className,
}) => {
	return (
		<Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className={className} />
	);
};
