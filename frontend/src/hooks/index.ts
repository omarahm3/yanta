// Re-export from command-palette domain for backward compatibility
export type {
	CommandUsageData,
	CommandUsageRecord,
	UseCommandUsageReturn,
} from "../command-palette";
export { useCommandUsage } from "../command-palette";
// Document hooks moved to document domain - backward compatibility shims
export { useDocumentEscapeHandling } from "../document/hooks/useDocumentEscapeHandling";
export { useDocumentForm } from "../document/hooks/useDocumentForm";
export { useDocumentLoader } from "../document/hooks/useDocumentLoader";
export { useAutoDocumentSaver } from "../document/hooks/useDocumentSaver";
// Re-export from help domain for backward compatibility
export { useHelp } from "../help";
// Re-export from hotkeys domain for backward compatibility
export { useHotkey, useHotkeys } from "../hotkeys";
// Re-export from onboarding domain for backward compatibility
export type {
	MilestoneHint,
	MilestoneHintId,
	OnboardingData,
	UseMilestoneHintsOptions,
	UseMilestoneHintsReturn,
	UseOnboardingReturn,
	UserProgressData,
	UseUserProgressReturn,
} from "../onboarding";
export {
	MILESTONE_HINT_IDS,
	MILESTONE_HINTS,
	useMilestoneHints,
	useOnboarding,
	useUserProgress,
} from "../onboarding";
export { useLatestRef } from "../shared/hooks/useLatestRef";
export type { UseLocalStorageOptions } from "../shared/hooks/useLocalStorage";
export { useLocalStorage } from "../shared/hooks/useLocalStorage";
export type { SaveState } from "./useAutoSave";
export { useAutoSave } from "./useAutoSave";
export type { UseCommandDeprecationReturn } from "./useCommandDeprecation";
export { DEPRECATED_COMMAND_MAPPINGS, useCommandDeprecation } from "./useCommandDeprecation";
export type { UseEscapeHandlerOptions } from "./useEscapeHandler";
export { useEscapeHandler } from "./useEscapeHandler";
export type { PageContext, UseFooterHintsOptions, UseFooterHintsReturn } from "./useFooterHints";
export { getHintsForPage, useFooterHints } from "./useFooterHints";
export type { UseFooterHintsSettingReturn } from "./useFooterHintsSetting";
export { useFooterHintsSetting } from "./useFooterHintsSetting";
export type { GitStatus, UseGitStatusReturn } from "./useGitStatus";
export { useGitStatus } from "./useGitStatus";
export { useGlobalCommand } from "./useGlobalCommand";
export type { NotificationOptions, NotificationType } from "./useNotification";
export { useNotification } from "./useNotification";
export type { RecentDocument, UseRecentDocumentsReturn } from "./useRecentDocuments";
export { useRecentDocuments } from "./useRecentDocuments";
export type { UseShortcutTooltipsSettingReturn } from "./useShortcutTooltipsSetting";
export { useShortcutTooltipsSetting } from "./useShortcutTooltipsSetting";
export { useSidebarSections } from "./useSidebarSections";
export type { UseSidebarSettingReturn } from "./useSidebarSetting";
export { useSidebarSetting } from "./useSidebarSetting";
