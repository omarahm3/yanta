import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import { useOnboarding } from "../hooks/useOnboarding";

export interface WelcomeOverlayProps {
	className?: string;
}

interface ShortcutBadgeProps {
	keys: string[];
	label: string;
}

const ShortcutBadge: React.FC<ShortcutBadgeProps> = ({ keys, label }) => {
	return (
		<div className="flex items-center gap-4 p-4 rounded-lg bg-bg border border-border">
			<div className="flex items-center gap-1">
				{keys.map((key, index) => (
					<span key={key}>
						{index > 0 && <span className="text-text-dim mx-1">+</span>}
						<kbd className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 text-sm font-mono font-semibold rounded bg-surface border border-border text-accent">
							{key}
						</kbd>
					</span>
				))}
			</div>
			<span className="text-text">{label}</span>
		</div>
	);
};

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ className }) => {
	const { shouldShowWelcome, dismissWelcome } = useOnboarding();
	const buttonRef = useRef<HTMLButtonElement>(null);

	const handleDismiss = useCallback(() => {
		dismissWelcome();
	}, [dismissWelcome]);

	useEffect(() => {
		if (!shouldShowWelcome) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Enter" || event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				handleDismiss();
			}
		};

		window.addEventListener("keydown", handleKeyDown, true);
		return () => {
			window.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [shouldShowWelcome, handleDismiss]);

	// Focus the button when overlay appears
	useEffect(() => {
		if (shouldShowWelcome && buttonRef.current) {
			buttonRef.current.focus();
		}
	}, [shouldShowWelcome]);

	if (!shouldShowWelcome) {
		return null;
	}

	return (
		<div
			className={cn(
				"fixed inset-0 z-50 flex items-center justify-center",
				className,
			)}
			data-testid="welcome-overlay"
		>
			{/* Semi-transparent dark backdrop - not clickable to dismiss */}
			<div
				className="absolute inset-0 bg-black/70"
				aria-hidden="true"
			/>

			{/* Centered card */}
			<div
				className="relative z-10 w-full max-w-md mx-4 p-8 rounded-lg bg-surface border border-border shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="welcome-title"
				aria-describedby="welcome-description"
			>
				{/* Header */}
				<div className="text-center mb-6">
					<h1
						id="welcome-title"
						className="text-2xl font-bold text-text-bright mb-2"
					>
						Welcome to YANTA
					</h1>
					<p
						id="welcome-description"
						className="text-text-dim"
					>
						Your keyboard-first note-taking companion
					</p>
				</div>

				{/* Keyboard shortcuts */}
				<div className="space-y-3 mb-6">
					<ShortcutBadge
						keys={["Ctrl", "K"]}
						label="Open Command Palette"
					/>
					<ShortcutBadge
						keys={["?"]}
						label="View All Shortcuts"
					/>
				</div>

				{/* Tip */}
				<p className="text-sm text-text-dim text-center mb-6">
					The command palette shows keyboard shortcuts for each action.
				</p>

				{/* Action button */}
				<button
					ref={buttonRef}
					type="button"
					onClick={handleDismiss}
					className="w-full btn btn-primary py-3 text-base font-semibold"
					data-testid="welcome-dismiss-button"
				>
					Got it, let's start
				</button>
			</div>
		</div>
	);
};
