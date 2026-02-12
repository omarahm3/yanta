import {
	GetPreferencesOverrides as GetPreferencesOverridesBinding,
	SetPreferencesOverrides as SetPreferencesOverridesBinding,
} from "../../../bindings/yanta/internal/config/wailsservice";
import {
	PreferencesOverrides as PreferencesOverridesModel,
	PreferencesTimeoutsOverrides as PreferencesTimeoutsOverridesModel,
	PreferencesShortcutsOverrides as PreferencesShortcutsOverridesModel,
	PreferencesLayoutOverrides as PreferencesLayoutOverridesModel,
} from "../../../bindings/yanta/internal/config/models";
import {
	type PreferencesOverrides,
	preferencesFromModel,
	preferencesToModel,
} from "../../config/preferences";

export async function getPreferencesOverrides(): Promise<PreferencesOverrides> {
	const model = await GetPreferencesOverridesBinding();
	return preferencesFromModel(model as unknown as Parameters<typeof preferencesFromModel>[0]);
}

export async function setPreferencesOverrides(overrides: PreferencesOverrides): Promise<void> {
	const { Timeouts, Shortcuts, Layout } = preferencesToModel(overrides);
	const model = new PreferencesOverridesModel({
		Timeouts: new PreferencesTimeoutsOverridesModel(Timeouts),
		Shortcuts: new PreferencesShortcutsOverridesModel(Shortcuts),
		Layout: new PreferencesLayoutOverridesModel(Layout),
	});
	await SetPreferencesOverridesBinding(model);
}
