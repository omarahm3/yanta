import { create } from "zustand";
import {
	type FeatureFlagName,
	type FeatureFlags,
	getEnvDefaultFeatureFlags,
} from "@/config/featureFlags";
import { getFeatureFlags as getFeatureFlagsFromBackend } from "../services/ConfigService";
import { BackendLogger } from "../utils/backendLogger";

interface FeatureFlagsState {
	flags: FeatureFlags;
	isLoading: boolean;
	loadFlags: () => Promise<void>;
	getFlag: (name: FeatureFlagName) => boolean;
}

const defaultFlags = getEnvDefaultFeatureFlags();

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
	flags: defaultFlags,
	isLoading: true,
	loadFlags: async () => {
		try {
			const flags = await getFeatureFlagsFromBackend();
			set({ flags, isLoading: false });
		} catch (err) {
			BackendLogger.error("[featureFlags.store] Failed to load feature flags:", err);
			set({ flags: defaultFlags, isLoading: false });
		}
	},
	getFlag: (name: FeatureFlagName) => get().flags[name],
}));
