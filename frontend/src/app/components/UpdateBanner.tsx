import type React from "react";
import { useCallback } from "react";
import { useEscapeHandler } from "../../shared/hooks/useEscapeHandler";
import { useUpdateCheck } from "../../shared/hooks/useUpdateCheck";
import { Button } from "../../shared/ui";
import { BackendLogger } from "../../shared/utils/backendLogger";
import { openExternalUrl } from "../../shared/utils/openExternalUrl";

/**
 * Non-intrusive, dismissible prompt shown when a newer YANTA release is
 * available on GitHub. It floats in the bottom-right corner so it never blocks
 * the editor or steals focus, checks once on mount, and respects per-version
 * dismissal. YANTA never self-installs — "View release" opens the release page
 * in the user's browser.
 */
export const UpdateBanner: React.FC = () => {
	const { updateInfo, showPrompt, dismiss } = useUpdateCheck({ autoCheck: true });

	const handleViewRelease = useCallback(async () => {
		if (!updateInfo?.releaseUrl) return;
		const result = await openExternalUrl(updateInfo.releaseUrl);
		if (!result.ok) {
			BackendLogger.error("Failed to open release URL:", result.error);
		}
	}, [updateInfo]);

	// Escape dismisses the prompt for keyboard-first users.
	useEscapeHandler({
		when: showPrompt,
		onEscape: dismiss,
		skipWhenDialogOpen: true,
	});

	if (!showPrompt || !updateInfo) return null;

	return (
		<div
			role="status"
			aria-live="polite"
			className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-glass-border bg-glass-bg/90 backdrop-blur-xl p-4 shadow-lg animate-fade-in"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="text-sm font-semibold text-text-bright">Update available</div>
				<button
					type="button"
					onClick={dismiss}
					aria-label="Dismiss update notification"
					className="text-text-dim hover:text-text transition-colors -mt-1 -mr-1 p-1 leading-none"
				>
					×
				</button>
			</div>
			<p className="mt-1 text-xs text-text-dim">
				YANTA{" "}
				<span className="font-mono text-cyan">v{updateInfo.latestVersion}</span> is available.
				{updateInfo.currentVersion && (
					<>
						{" "}
						You have <span className="font-mono">v{updateInfo.currentVersion}</span>.
					</>
				)}
			</p>
			<div className="mt-3 flex items-center justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={dismiss}>
					Later
				</Button>
				<Button variant="primary" size="sm" onClick={handleViewRelease}>
					View release
				</Button>
			</div>
		</div>
	);
};
