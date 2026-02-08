// Public API for onboarding domain

export type { MilestoneHintProps, WelcomeOverlayProps } from "./components";
export { MilestoneHint, MilestoneHintManager, WelcomeOverlay } from "./components";
export { UserProgressProvider, useUserProgressContext } from "./context";
export type {
	MilestoneHintId,
	OnboardingData,
	UseMilestoneHintsOptions,
	UseMilestoneHintsReturn,
	UseOnboardingReturn,
	UserProgressData,
	UseUserProgressReturn,
} from "./hooks";
export {
	MILESTONE_HINT_IDS,
	MILESTONE_HINTS,
	useMilestoneHints,
	useOnboarding,
	useUserProgress,
} from "./hooks";
// MilestoneHint interface already exported from hooks via MILESTONE_HINTS
