// Public API for onboarding domain
export { WelcomeOverlay, MilestoneHint, MilestoneHintManager } from "./components";
export type { WelcomeOverlayProps, MilestoneHintProps } from "./components";
export { UserProgressProvider, useUserProgressContext } from "./context";
export {
	useOnboarding,
	useUserProgress,
	useMilestoneHints,
	MILESTONE_HINT_IDS,
	MILESTONE_HINTS,
} from "./hooks";
export type {
	OnboardingData,
	UseOnboardingReturn,
	UserProgressData,
	UseUserProgressReturn,
	MilestoneHintId,
	UseMilestoneHintsOptions,
	UseMilestoneHintsReturn,
} from "./hooks";
// MilestoneHint interface already exported from hooks via MILESTONE_HINTS
