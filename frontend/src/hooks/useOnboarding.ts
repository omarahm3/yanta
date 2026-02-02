import { useCallback, useEffect, useState } from "react";

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
}

function getDefaultOnboardingData(): OnboardingData {
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
		if (
			typeof parsed.completedWelcome !== "boolean" ||
			typeof parsed.version !== "string"
		) {
			return null;
		}
		// Optional completedAt field
		if (
			parsed.completedAt !== undefined &&
			typeof parsed.completedAt !== "number"
		) {
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
	const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(
		() => loadOnboardingData()
	);

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
	}, []);

	return {
		hasCompletedOnboarding,
		completeOnboarding,
		resetOnboarding,
		onboardingData,
	};
}
