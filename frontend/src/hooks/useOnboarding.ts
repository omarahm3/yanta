import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "yanta_onboarding";
const CURRENT_VERSION = "1.0.0";
const WELCOME_DELAY_MS = 500;

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

function _getDefaultOnboardingData(): OnboardingData {
	return {
		completedWelcome: false,
		version: CURRENT_VERSION,
	};
}

function loadOnboardingData(): OnboardingData | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return null;
		}
		const parsed = JSON.parse(stored);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return null;
		}
		// Validate the structure
		if (typeof parsed.completedWelcome !== "boolean" || typeof parsed.version !== "string") {
			return null;
		}
		// Optional completedAt field
		if (parsed.completedAt !== undefined && typeof parsed.completedAt !== "number") {
			return null;
		}
		return parsed as OnboardingData;
	} catch {
		return null;
	}
}

function saveOnboardingData(data: OnboardingData): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (err) {
		console.error("[useOnboarding] Failed to save to localStorage:", err);
	}
}

function clearOnboardingData(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (err) {
		console.error("[useOnboarding] Failed to clear localStorage:", err);
	}
}

export function useOnboarding(): UseOnboardingReturn {
	const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(() =>
		loadOnboardingData(),
	);
	const [shouldShowWelcome, setShouldShowWelcome] = useState(false);
	const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				setOnboardingData(loadOnboardingData());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, []);

	// Startup check: show welcome overlay after delay if onboarding not complete
	useEffect(() => {
		const currentData = loadOnboardingData();
		const hasCompleted = currentData?.completedWelcome ?? false;

		if (!hasCompleted) {
			welcomeTimerRef.current = setTimeout(() => {
				setShouldShowWelcome(true);
			}, WELCOME_DELAY_MS);
		}

		return () => {
			if (welcomeTimerRef.current) {
				clearTimeout(welcomeTimerRef.current);
			}
		};
	}, []);

	const hasCompletedOnboarding = useCallback((): boolean => {
		return onboardingData?.completedWelcome ?? false;
	}, [onboardingData]);

	const completeOnboarding = useCallback(() => {
		const data: OnboardingData = {
			completedWelcome: true,
			completedAt: Date.now(),
			version: CURRENT_VERSION,
		};
		saveOnboardingData(data);
		setOnboardingData(data);
	}, []);

	const resetOnboarding = useCallback(() => {
		clearOnboardingData();
		setOnboardingData(null);
		setShouldShowWelcome(false);
	}, []);

	const dismissWelcome = useCallback(() => {
		setShouldShowWelcome(false);
		const data: OnboardingData = {
			completedWelcome: true,
			completedAt: Date.now(),
			version: CURRENT_VERSION,
		};
		saveOnboardingData(data);
		setOnboardingData(data);
	}, []);

	return {
		hasCompletedOnboarding,
		completeOnboarding,
		resetOnboarding,
		onboardingData,
		shouldShowWelcome,
		dismissWelcome,
	};
}
