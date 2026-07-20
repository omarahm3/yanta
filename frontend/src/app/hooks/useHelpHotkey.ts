import { GLOBAL_SHORTCUTS } from "@/config/public";
import { useHelp } from "../../help";
import { useHotkey } from "../../hotkeys";

export function useHelpHotkey(): void {
	const { openHelp } = useHelp();
	useHotkey({
		...GLOBAL_SHORTCUTS.help,
		handler: (e) => {
			// Capture phase + stopImmediatePropagation so the canvas's Excalidraw
			// (which binds a global document keydown via handleKeyboardGlobally) never
			// sees "?" and opens its own shortcuts dialog. Without this, "?" triggered
			// both YANTA help and Excalidraw help.
			e.preventDefault();
			e.stopImmediatePropagation();
			openHelp();
		},
		allowInInput: false,
		capture: true,
	});
}
