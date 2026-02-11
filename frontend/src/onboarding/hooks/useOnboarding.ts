/**
 * Onboarding is now in shared/stores/onboarding.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export {
	type OnboardingData,
	type UseOnboardingReturn,
	useOnboarding,
} from "../../shared/stores/onboarding.store";
