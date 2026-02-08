// Re-export from document domain for backward compatibility
export {
	DocumentCountProvider,
	DocumentProvider,
	useDocumentContext,
	useDocumentCount,
} from "../document";
// Re-export from help domain for backward compatibility
export { HelpProvider, useHelpContext } from "../help";
// Re-export from hotkeys domain for backward compatibility
export { HotkeyProvider, useHotkeyContext } from "../hotkeys";
// Re-export from onboarding domain for backward compatibility
export { UserProgressProvider, useUserProgressContext } from "../onboarding";
export type { PaneLayoutContextValue } from "../pane";
export { PaneLayoutContext, PaneLayoutProvider } from "../pane";
// TODO: Remove this once we have a proper projects page
// Re-export from project domain for backward compatibility
export { ProjectContext, ProjectProvider, useProjectContext } from "../project";
export { DialogProvider, useDialog } from "./DialogContext";
export { useScale } from "./ScaleContext";
export { TitleBarProvider, useTitleBarContext } from "./TitleBarContext";
