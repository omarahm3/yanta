import { GLOBAL_SHORTCUTS } from "../../config";
import { useHelp } from "../../help";
import { useHotkey } from "../../hotkeys";

export function useHelpHotkey(): void {
	const { openHelp } = useHelp();
	useHotkey({
		...GLOBAL_SHORTCUTS.help,
		handler: openHelp,
		allowInInput: false,
	});
}
