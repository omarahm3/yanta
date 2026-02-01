import { HotkeyConfig as HotkeyConfigModel } from "../../bindings/yanta/internal/config/models";

// Global hotkey configuration for system-wide shortcuts
export interface GlobalHotkeyConfig {
	quickCaptureEnabled: boolean;
	quickCaptureHotkey: string; // e.g., "Ctrl+Shift+N"
}

// Convert from Go/Wails model format (PascalCase) to JS (camelCase)
export function globalHotkeyConfigFromModel(model: HotkeyConfigModel): GlobalHotkeyConfig {
	const modifiers = model.QuickCaptureModifiers || [];
	const key = model.QuickCaptureKey || "";
	return {
		quickCaptureEnabled: model.QuickCaptureEnabled,
		quickCaptureHotkey: formatHotkey(modifiers, key),
	};
}

// Convert from JS (camelCase) to Go/Wails model format (PascalCase)
export function globalHotkeyConfigToModel(config: GlobalHotkeyConfig): HotkeyConfigModel {
	const { modifiers, key } = parseHotkey(config.quickCaptureHotkey);
	return new HotkeyConfigModel({
		QuickCaptureEnabled: config.quickCaptureEnabled,
		QuickCaptureModifiers: modifiers,
		QuickCaptureKey: key,
	});
}

// Format modifiers and key as a hotkey string
export function formatHotkey(modifiers: string[], key: string): string {
	if (!key) return "";
	return [...modifiers, key].join("+");
}

// Parse a hotkey string into modifiers and key
export function parseHotkey(hotkey: string): { modifiers: string[]; key: string } {
	if (!hotkey) return { modifiers: [], key: "" };

	const parts = hotkey.split("+");
	if (parts.length === 0) return { modifiers: [], key: "" };

	const key = parts[parts.length - 1];
	const modifiers = parts.slice(0, -1);

	return { modifiers, key };
}
