import type React from "react";
import { Button } from "./Button";
import { Heading } from "./Heading";
import { Text } from "./Text";

export interface EmptyStateProps {
	icon: React.ReactNode;
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
	className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
	icon,
	title,
	description,
	actionLabel,
	onAction,
	className,
}) => (
	<div
		className={`flex min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-glass-border bg-glass-bg/10 px-6 py-10 text-center ${className ?? ""}`}
	>
		<div className="flex max-w-md flex-col items-center gap-4">
			<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-glass-bg/40 text-accent">
				{icon}
			</div>
			<div className="space-y-2">
				<Heading as="h2" size="lg">
					{title}
				</Heading>
				{description ? (
					<Text size="sm" variant="dim" className="leading-6">
						{description}
					</Text>
				) : null}
			</div>
			{actionLabel && onAction ? (
				<Button type="button" onClick={onAction}>
					{actionLabel}
				</Button>
			) : null}
		</div>
	</div>
);
