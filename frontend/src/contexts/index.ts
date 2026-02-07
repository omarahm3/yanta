export { DialogProvider, useDialog } from "./DialogContext";
// Re-export from document domain for backward compatibility
export {
	DocumentProvider,
	useDocumentContext,
	DocumentCountProvider,
	useDocumentCount,
} from "../document";
export { HelpProvider, useHelpContext } from "./HelpContext";
export { HotkeyProvider, useHotkeyContext } from "./HotkeyContext";
export type { PaneLayoutContextValue } from "../pane";
export { PaneLayoutContext, PaneLayoutProvider } from "../pane";
// TODO: Remove this once we have a proper projects page
// Re-export from project domain for backward compatibility
export { ProjectContext, ProjectProvider, useProjectContext } from "../project";
export { ScaleProvider, useScale } from "./ScaleContext";
export { TitleBarProvider, useTitleBarContext } from "./TitleBarContext";
// Re-export from onboarding domain for backward compatibility
export { UserProgressProvider, useUserProgressContext } from "../onboarding";
