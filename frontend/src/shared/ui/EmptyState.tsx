import type React from "react";
import { cn } from "../utils/cn";
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
		className={cn(
			"flex min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center animate-stagger-fade-in",
			className,
		)}
	>
		<div className="flex max-w-md flex-col items-center gap-4">
			<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
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
