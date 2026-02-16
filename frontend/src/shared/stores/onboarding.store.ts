import { useEffect, useState } from "react";
import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { getMergedConfig } from "@/shared/stores/preferences.store";
import { BackendLogger } from "../utils/backendLogger";

const STORAGE_KEY = "yanta_onboarding";
const CURRENT_VERSION = "1.0.0";

export interface OnboardingData {
	completedWelcome: boolean;
	completedAt?: number;
	version: string;
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

interface OnboardingState {
	onboardingData: OnboardingData | null;
	completeOnboarding: () => void;
	resetOnboarding: () => void;
	hasCompletedOnboarding: () => boolean;
}

const onboardingStorage: PersistStorage<{ onboardingData: OnboardingData | null }> = {
	getItem: (name: string) => {
		try {
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			const onboardingData = validateOnboardingData(parsed);
			return { state: { onboardingData: onboardingData ?? null } };
		} catch (err) {
			BackendLogger.error("[onboarding.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name: string, value: { state: { onboardingData: OnboardingData | null } }) => {
		try {
			if (value.state.onboardingData === null) {
				localStorage.removeItem(name);
			} else {
				localStorage.setItem(name, JSON.stringify(value.state.onboardingData));
			}
		} catch (err) {
			BackendLogger.error("[onboarding.store] Failed to save:", err);
		}
	},
	removeItem: (name: string) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[onboarding.store] Failed to clear:", err);
		}
	},
};

export const useOnboardingStore = create<OnboardingState>()(
	persist(
		(set, get) => ({
			onboardingData: null,
			completeOnboarding: () => {
				set({
					onboardingData: {
						completedWelcome: true,
						completedAt: Date.now(),
						version: CURRENT_VERSION,
					},
				});
			},
			resetOnboarding: () => {
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (err) {
					BackendLogger.error("[onboarding.store] Failed to clear localStorage:", err);
				}
				set({ onboardingData: null });
			},
			hasCompletedOnboarding: () => get().onboardingData?.completedWelcome ?? false,
		}),
		{
			name: STORAGE_KEY,
			storage: onboardingStorage,
			partialize: (s) => ({ onboardingData: s.onboardingData }),
		},
	),
);

export interface UseOnboardingReturn {
	hasCompletedOnboarding: () => boolean;
	completeOnboarding: () => void;
	resetOnboarding: () => void;
	onboardingData: OnboardingData | null;
	shouldShowWelcome: boolean;
	dismissWelcome: () => void;
}

export function useOnboarding(): UseOnboardingReturn {
	const onboardingData = useOnboardingStore((s) => s.onboardingData);
	const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
	const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
	const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);

	const [shouldShowWelcome, setShouldShowWelcome] = useState(false);

	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
				useOnboardingStore.persist?.rehydrate();
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	useEffect(() => {
		const hasCompleted = onboardingData?.completedWelcome ?? false;
		if (!hasCompleted) {
			const timer = setTimeout(
				() => setShouldShowWelcome(true),
				getMergedConfig().timeouts.welcomeDelayMs,
			);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [onboardingData]);

	const dismissWelcome = () => {
		setShouldShowWelcome(false);
		completeOnboarding();
	};

	const resetOnboardingAndHideWelcome = () => {
		setShouldShowWelcome(false);
		resetOnboarding();
	};

	return {
		hasCompletedOnboarding,
		completeOnboarding,
		resetOnboarding: resetOnboardingAndHideWelcome,
		onboardingData,
		shouldShowWelcome,
		dismissWelcome,
	};
}
