import React from "react";
import { Button, ConfirmDialog, Label, SettingsSection } from "../../components/ui";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useUserProgress } from "../../hooks/useUserProgress";
import { useNotification } from "../../hooks/useNotification";
import type { SystemInfo } from "../../types";

interface AboutSectionProps {
	systemInfo: SystemInfo | null;
}

export const AboutSection = React.forwardRef<HTMLDivElement, AboutSectionProps>(
	({ systemInfo }, ref) => {
		const { resetOnboarding } = useOnboarding();
		const { resetProgress, progressData } = useUserProgress();
		const { success } = useNotification();

		const [showResetOnboardingConfirm, setShowResetOnboardingConfirm] = React.useState(false);
		const [showResetHintsConfirm, setShowResetHintsConfirm] = React.useState(false);

		const handleResetOnboarding = () => {
			resetOnboarding();
			setShowResetOnboardingConfirm(false);
			success("Onboarding reset. The welcome overlay will appear on next launch.");
		};

		const handleResetHints = () => {
			resetProgress();
			setShowResetHintsConfirm(false);
			success("Hints reset. Milestone hints will appear again as you use the app.");
		};

		const hintsShownCount = progressData.hintsShown.length;

		return (
			<div ref={ref}>
				<SettingsSection title="About Yanta" subtitle="Version and system information">
					{systemInfo ? (
						<div className="grid grid-cols-2 gap-4">
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Version</div>
								<div className="font-mono text-sm text-text">{systemInfo.app.version}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Build Commit</div>
								<div className="font-mono text-sm text-cyan">{systemInfo.app.buildCommit || "N/A"}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Build Date</div>
								<div className="font-mono text-sm text-text">{systemInfo.app.buildDate || "N/A"}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Platform</div>
								<div className="font-mono text-sm text-text">{systemInfo.app.platform}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Go Version</div>
								<div className="font-mono text-sm text-text">{systemInfo.app.goVersion}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Documents</div>
								<div className="font-mono text-sm text-text">{systemInfo.database.entriesCount}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Projects</div>
								<div className="font-mono text-sm text-text">{systemInfo.database.projectsCount}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Tags</div>
								<div className="font-mono text-sm text-text">{systemInfo.database.tagsCount}</div>
							</div>
							<div>
								<div className="mb-1 text-xs tracking-wider uppercase text-text-dim">Storage Used</div>
								<div className="font-mono text-sm text-text">{systemInfo.database.storageUsed}</div>
							</div>
						</div>
					) : (
						<div className="text-sm text-text-dim">Loading system information...</div>
					)}
				</SettingsSection>

				<SettingsSection title="Onboarding & Hints" subtitle="Reset onboarding experience and milestone hints">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-text">Reset Onboarding</div>
								<div className="text-xs text-text-dim">
									Show the welcome overlay again on next launch
								</div>
							</div>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setShowResetOnboardingConfirm(true)}
							>
								Reset Onboarding
							</Button>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-text">Reset Hints</div>
								<div className="text-xs text-text-dim">
									Clear shown hints to see milestone tips again
									{hintsShownCount > 0 && (
										<span className="ml-1 text-text">({hintsShownCount} hints shown)</span>
									)}
								</div>
							</div>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setShowResetHintsConfirm(true)}
							>
								Reset Hints
							</Button>
						</div>
					</div>
				</SettingsSection>

				<ConfirmDialog
					isOpen={showResetOnboardingConfirm}
					onCancel={() => setShowResetOnboardingConfirm(false)}
					onConfirm={handleResetOnboarding}
					title="Reset Onboarding?"
					message="This will reset your onboarding status. The welcome overlay will appear the next time you launch the app."
					confirmText="Reset"
					cancelText="Cancel"
				/>

				<ConfirmDialog
					isOpen={showResetHintsConfirm}
					onCancel={() => setShowResetHintsConfirm(false)}
					onConfirm={handleResetHints}
					title="Reset Hints?"
					message="This will clear all milestone hint history and reset your usage progress. Hints will appear again as you reach milestones."
					confirmText="Reset"
					cancelText="Cancel"
				/>
			</div>
		);
	},
);

AboutSection.displayName = "AboutSection";
