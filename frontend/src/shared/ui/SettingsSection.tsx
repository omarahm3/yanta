import type React from "react";
import { cn } from "../utils/cn";

export interface SettingsSectionProps {
	title: string;
	subtitle?: string;
	/** Stable id used as the heading anchor and section landmark for in-page nav. */
	id?: string;
	children: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
	title,
	subtitle,
	id,
	children,
	actions,
	className,
}) => {
	const headingId = id ? `settings-${id}-heading` : undefined;
	return (
		<section
			aria-labelledby={headingId}
			className={cn("bg-surface/85 border border-border rounded-xl p-6 mb-6 scroll-mt-6", className)}
		>
			<div className="flex items-center justify-between mb-5 pb-3 border-b border-border">
				<div>
					<h2 id={headingId} className="text-text-bright text-base font-semibold">
						{title}
					</h2>
					{subtitle && <div className="text-text-dim text-xs mt-1">{subtitle}</div>}
				</div>
				{actions && <div>{actions}</div>}
			</div>
			{children}
		</section>
	);
};
