import { useHelpHotkey } from "./useHelpHotkey";
import { useProjectSwitchTracking } from "./useProjectSwitchTracking";
import { useQuitHotkeys } from "./useQuitHotkeys";
import { useWindowHiddenToast } from "./useWindowHiddenToast";

export function useAppGlobalEffects(): void {
	useHelpHotkey();
	useQuitHotkeys();
	useWindowHiddenToast();
	useProjectSwitchTracking();
}
