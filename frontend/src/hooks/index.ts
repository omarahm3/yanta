export type { SaveState } from "./useAutoSave";
export { useAutoSave } from "./useAutoSave";
export type { UseLocalStorageOptions } from "../shared/hooks/useLocalStorage";
export { useLocalStorage } from "../shared/hooks/useLocalStorage";
export type { UseCommandDeprecationReturn } from "./useCommandDeprecation";
export { DEPRECATED_COMMAND_MAPPINGS, useCommandDeprecation } from "./useCommandDeprecation";
export type {
	CommandUsageData,
	CommandUsageRecord,
	UseCommandUsageReturn,
} from "./useCommandUsage";
export { useCommandUsage } from "./useCommandUsage";
// Document hooks moved to document domain - backward compatibility shims
export { useDocumentEscapeHandling } from "../document/hooks/useDocumentEscapeHandling";
export { useDocumentForm } from "../document/hooks/useDocumentForm";
export { useDocumentLoader } from "../document/hooks/useDocumentLoader";
export { useAutoDocumentSaver } from "../document/hooks/useDocumentSaver";
export type { UseEscapeHandlerOptions } from "./useEscapeHandler";
export { useEscapeHandler } from "./useEscapeHandler";
export type { PageContext, UseFooterHintsOptions, UseFooterHintsReturn } from "./useFooterHints";
export { getHintsForPage, useFooterHints } from "./useFooterHints";
export type { UseFooterHintsSettingReturn } from "./useFooterHintsSetting";
export { useFooterHintsSetting } from "./useFooterHintsSetting";
export type { GitStatus, UseGitStatusReturn } from "./useGitStatus";
export { useGitStatus } from "./useGitStatus";
export { useGlobalCommand } from "./useGlobalCommand";
export { useHelp } from "./useHelp";
export { useHotkey, useHotkeys } from "./useHotkey";
export { useLatestRef } from "../shared/hooks/useLatestRef";
export type {
	MilestoneHint,
	MilestoneHintId,
	UseMilestoneHintsOptions,
	UseMilestoneHintsReturn,
} from "./useMilestoneHints";
export {
	MILESTONE_HINT_IDS,
	MILESTONE_HINTS,
	useMilestoneHints,
} from "./useMilestoneHints";
export type { NotificationOptions, NotificationType } from "./useNotification";
export { useNotification } from "./useNotification";
export type { OnboardingData, UseOnboardingReturn } from "./useOnboarding";
export { useOnboarding } from "./useOnboarding";
export type { RecentDocument, UseRecentDocumentsReturn } from "./useRecentDocuments";
export { useRecentDocuments } from "./useRecentDocuments";
export type { UseShortcutTooltipsSettingReturn } from "./useShortcutTooltipsSetting";
export { useShortcutTooltipsSetting } from "./useShortcutTooltipsSetting";
export { useSidebarSections } from "./useSidebarSections";
export type { UseSidebarSettingReturn } from "./useSidebarSetting";
export { useSidebarSetting } from "./useSidebarSetting";
export type { UserProgressData, UseUserProgressReturn } from "./useUserProgress";
export { useUserProgress } from "./useUserProgress";
