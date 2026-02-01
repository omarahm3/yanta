import { HotkeyConfig as HotkeyConfigModel } from "../../bindings/yanta/internal/config/models";

// Global hotkey configuration for system-wide shortcuts
export interface GlobalHotkeyConfig {
	quickCaptureEnabled: boolean;
	quickCaptureModifiers: string[]; // e.g., ["Ctrl", "Shift"]
	quickCaptureKey: string; // e.g., "N"
}

// Convert from Go/Wails model format (PascalCase) to JS (camelCase)
export function globalHotkeyConfigFromModel(model: HotkeyConfigModel): GlobalHotkeyConfig {
	return {
		quickCaptureEnabled: model.QuickCaptureEnabled,
		quickCaptureModifiers: model.QuickCaptureModifiers || [],
		quickCaptureKey: model.QuickCaptureKey,
	};
}

// Convert from JS (camelCase) to Go/Wails model format (PascalCase)
export function globalHotkeyConfigToModel(config: GlobalHotkeyConfig): HotkeyConfigModel {
	return new HotkeyConfigModel({
		QuickCaptureEnabled: config.quickCaptureEnabled,
		QuickCaptureModifiers: config.quickCaptureModifiers,
		QuickCaptureKey: config.quickCaptureKey,
	});
}

// Format a hotkey configuration as a human-readable string
export function formatHotkey(modifiers: string[], key: string): string {
	return [...modifiers, key].join("+");
}
