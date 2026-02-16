import {
	type FeatureFlags,
	featureFlagsFromModel,
	getEnvDefaultFeatureFlags,
} from "@/config/featureFlags";
import {
	type PreferencesOverrides,
	preferencesFromModel,
	preferencesToModel,
} from "@/config/preferences";
import {
	PreferencesLayoutOverrides as PreferencesLayoutOverridesModel,
	PreferencesOverrides as PreferencesOverridesModel,
	PreferencesShortcutsOverrides as PreferencesShortcutsOverridesModel,
	PreferencesTimeoutsOverrides as PreferencesTimeoutsOverridesModel,
} from "../../../bindings/yanta/internal/config/models";
import * as ConfigBindings from "../../../bindings/yanta/internal/config/wailsservice";

export async function getPreferencesOverrides(): Promise<PreferencesOverrides> {
	const model = await ConfigBindings.GetPreferencesOverrides();
	return preferencesFromModel(model as unknown as Parameters<typeof preferencesFromModel>[0]);
}

export async function setPreferencesOverrides(overrides: PreferencesOverrides): Promise<void> {
	const { Timeouts, Shortcuts, Layout, Graphics, Plugins } = preferencesToModel(overrides);
	const model = new PreferencesOverridesModel({
		Timeouts: new PreferencesTimeoutsOverridesModel(Timeouts),
		Shortcuts: new PreferencesShortcutsOverridesModel(Shortcuts),
		Layout: new PreferencesLayoutOverridesModel(Layout),
		Graphics,
		Plugins: Plugins ?? {},
	} as unknown as ConstructorParameters<typeof PreferencesOverridesModel>[0]);
	await ConfigBindings.SetPreferencesOverrides(model);
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
	const bindingModule = ConfigBindings as unknown as Record<string, unknown>;
	const methodName = ["Get", "FeatureFlags"].join("");
	const getFeatureFlagsBinding = bindingModule[methodName];
	if (typeof getFeatureFlagsBinding !== "function") {
		return getEnvDefaultFeatureFlags();
	}
	const model = await getFeatureFlagsBinding();
	return featureFlagsFromModel(model as unknown as Parameters<typeof featureFlagsFromModel>[0]);
}
