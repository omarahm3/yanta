import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TIMEOUTS } from "../config";
import { cn } from "../lib/utils";

export interface MilestoneHintProps {
	hintId: string;
	text: string;
	onDismiss: (hintId: string) => void;
	className?: string;
	autoDismissMs?: number;
}

export const MilestoneHint: React.FC<MilestoneHintProps> = ({
	hintId,
	text,
	onDismiss,
	className,
	autoDismissMs = 8000,
}) => {
	const [isVisible, setIsVisible] = useState(true);
	const [isExiting, setIsExiting] = useState(false);
	const isDismissedRef = useRef(false);
	const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleDismiss = useCallback(() => {
		if (isDismissedRef.current) return;
		isDismissedRef.current = true;

		// Clear the auto-dismiss timer if it's still running
		if (autoTimerRef.current) {
			clearTimeout(autoTimerRef.current);
			autoTimerRef.current = null;
		}

		setIsExiting(true);
		// Allow exit animation to complete before calling onDismiss
		animationTimerRef.current = setTimeout(() => {
			setIsVisible(false);
			onDismiss(hintId);
		}, TIMEOUTS.milestoneAnimationMs);
	}, [hintId, onDismiss]);

	// Auto-dismiss after specified time
	useEffect(() => {
		if (autoDismissMs <= 0) return;

		autoTimerRef.current = setTimeout(() => {
			handleDismiss();
		}, autoDismissMs);

		return () => {
			if (autoTimerRef.current) {
				clearTimeout(autoTimerRef.current);
				autoTimerRef.current = null;
			}
		};
	}, [autoDismissMs, handleDismiss]);

	// Cleanup animation timer on unmount
	useEffect(() => {
		return () => {
			if (animationTimerRef.current) {
				clearTimeout(animationTimerRef.current);
			}
		};
	}, []);

	if (!isVisible) {
		return null;
	}

	return (
		<div
			className={cn(
				"fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
				"flex items-center gap-3 px-4 py-3 rounded-lg",
				"bg-glass-bg/80 backdrop-blur-xl border border-glass-border shadow-lg",
				"transition-all duration-200",
				isExiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
				className,
			)}
			role="status"
			aria-live="polite"
			data-testid="milestone-hint"
			data-hint-id={hintId}
		>
			<span className="text-accent font-semibold">Tip:</span>
			<span className="text-text">{text}</span>
			<button
				type="button"
				onClick={handleDismiss}
				className="ml-2 p-1 rounded hover:bg-glass-bg/30 text-text-dim hover:text-text transition-colors"
				aria-label="Dismiss hint"
				data-testid="milestone-hint-dismiss"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	);
};
