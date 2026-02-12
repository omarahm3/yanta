import { BackgroundQuit, ForceQuit } from "../../../bindings/yanta/internal/system/service";
import { GLOBAL_SHORTCUTS } from "../../config";
import { useHotkey } from "../../hotkeys";

export function useQuitHotkeys(): void {
	useHotkey({
		...GLOBAL_SHORTCUTS.quit,
		capture: true,
		handler: (e) => {
			e.preventDefault();
			BackgroundQuit();
		},
		allowInInput: true,
	});

	useHotkey({
		...GLOBAL_SHORTCUTS.forceQuit,
		capture: true,
		handler: (e) => {
			e.preventDefault();
			ForceQuit();
		},
		allowInInput: true,
	});
}
