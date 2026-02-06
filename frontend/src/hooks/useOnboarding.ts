import { useCallback, useEffect, useRef, useState } from "react";
import { TIMEOUTS } from "@/config";
import { BackendLogger } from "../utils/backendLogger";
import { useLocalStorage } from "../shared/hooks/useLocalStorage";

const STORAGE_KEY = "yanta_onboarding";
const CURRENT_VERSION = "1.0.0";

export interface OnboardingData {
	completedWelcome: boolean;
	completedAt?: number;
	version: string;
}

export interface UseOnboardingReturn {
	hasCompletedOnboarding: () => boolean;
	completeOnboarding: () => void;
	resetOnboarding: () => void;
	onboardingData: OnboardingData | null;
	shouldShowWelcome: boolean;
	dismissWelcome: () => void;
}

function validateOnboardingData(data: unknown): OnboardingData | null {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	const parsed = data as Record<string, unknown>;
	if (typeof parsed.completedWelcome !== "boolean" || typeof parsed.version !== "string") {
		return null;
	}
	if (parsed.completedAt !== undefined && typeof parsed.completedAt !== "number") {
		return null;
	}
	return data as OnboardingData;
}

export function useOnboarding(): UseOnboardingReturn {
	const [onboardingData, setOnboardingData] = useLocalStorage<OnboardingData | null>(
		STORAGE_KEY,
		null,
		{
			validate: validateOnboardingData,
			onError: (operation, err) => {
				BackendLogger.error(`[useOnboarding] Failed to ${operation}:`, err);
			},
		},
	);
	const [shouldShowWelcome, setShouldShowWelcome] = useState(false);
	const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Startup check: show welcome overlay after delay if onboarding not complete
	useEffect(() => {
		const hasCompleted = onboardingData?.completedWelcome ?? false;

		if (!hasCompleted) {
			welcomeTimerRef.current = setTimeout(() => {
				setShouldShowWelcome(true);
			}, TIMEOUTS.welcomeDelayMs);
		}

		return () => {
			if (welcomeTimerRef.current) {
				clearTimeout(welcomeTimerRef.current);
			}
		};
	}, [onboardingData]);

	const hasCompletedOnboarding = useCallback((): boolean => {
		return onboardingData?.completedWelcome ?? false;
	}, [onboardingData]);

	const completeOnboarding = useCallback(() => {
		const data: OnboardingData = {
			completedWelcome: true,
			completedAt: Date.now(),
			version: CURRENT_VERSION,
		};
		setOnboardingData(data);
	}, [setOnboardingData]);

	const resetOnboarding = useCallback(() => {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (err) {
			BackendLogger.error("[useOnboarding] Failed to clear localStorage:", err);
		}
		setOnboardingData(null);
		setShouldShowWelcome(false);
	}, [setOnboardingData]);

	const dismissWelcome = useCallback(() => {
		setShouldShowWelcome(false);
		const data: OnboardingData = {
			completedWelcome: true,
			completedAt: Date.now(),
			version: CURRENT_VERSION,
		};
		setOnboardingData(data);
	}, [setOnboardingData]);

	return {
		hasCompletedOnboarding,
		completeOnboarding,
		resetOnboarding,
		onboardingData,
		shouldShowWelcome,
		dismissWelcome,
	};
}
