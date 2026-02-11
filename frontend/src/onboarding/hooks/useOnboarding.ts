/**
 * Onboarding is now in shared/stores/onboarding.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export {
	useOnboarding,
	type OnboardingData,
	type UseOnboardingReturn,
} from "../../shared/stores/onboarding.store";
