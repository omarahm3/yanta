import { GLOBAL_SHORTCUTS } from "../../config";
import { useHelp, useHotkey } from "../../hooks";

export function useHelpHotkey(): void {
	const { openHelp } = useHelp();
	useHotkey({
		...GLOBAL_SHORTCUTS.help,
		handler: openHelp,
		allowInInput: false,
	});
}
