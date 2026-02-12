import type React from "react";
import { cn } from "../utils/cn";

export interface SettingsSectionProps {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
	title,
	subtitle,
	children,
	actions,
	className,
}) => {
	return (
		<div
			className={cn(
				"bg-glass-bg/20 backdrop-blur-md border border-glass-border rounded-xl p-6 mb-6 shadow-sm",
				className,
			)}
		>
			<div className="flex items-center justify-between mb-5 pb-3 border-b border-glass-border">
				<div>
					<div className="text-text-bright text-base font-semibold">{title}</div>
					{subtitle && <div className="text-text-dim text-xs mt-1">{subtitle}</div>}
				</div>
				{actions && <div>{actions}</div>}
			</div>
			{children}
		</div>
	);
};
