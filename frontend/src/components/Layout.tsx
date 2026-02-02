import type React from "react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { useProjectContext, useTitleBarContext } from "../contexts";
import {
	useCommandDeprecation,
	useFooterHints,
	useFooterHintsSetting,
	useGlobalCommand,
	useHotkeys,
	useNotification,
	useSidebarSetting,
} from "../hooks";
import { ContextBar, FooterHintBar, HeaderBar, type SidebarSection, Sidebar as UISidebar } from "./ui";
import { CommandLine } from "./ui/commandline";

/**
 * Converts the current page identifier to a display-friendly page name.
 */
const getPageDisplayName = (page: string): string => {
	switch (page) {
		case "dashboard":
			return "Documents";
		case "document":
			return "Document";
		case "journal":
			return "Journal";
		case "settings":
			return "Settings";
		case "projects":
			return "Projects";
		case "search":
			return "Search";
		default:
			return page.charAt(0).toUpperCase() + page.slice(1);
	}
};

/**
 * Checks if the current page should show the ContextBar.
 * ContextBar appears on content pages: dashboard, document, journal.
 */
const shouldShowContextBar = (page: string): boolean => {
	return ["dashboard", "document", "journal"].includes(page);
};

export interface LayoutProps {
	sidebarTitle?: string;
	sidebarSections?: SidebarSection[];
	sidebarContent?: ReactNode;
	breadcrumb?: string;
	currentPage: string;
	headerShortcuts?: Array<{
		key: string;
		label: string;
	}>;
	children: ReactNode;
	showCommandLine?: boolean;
	commandContext?: string;
	commandPlaceholder?: string;
	commandValue?: string;
	onCommandChange?: (value: string) => void;
	onCommandSubmit?: (command: string) => void;
	commandInputRef?: React.RefObject<HTMLInputElement>;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

/**
 * Determines the mode based on the current page.
 * - "documents": Dashboard and document pages
 * - "journal": Journal page
 * - "neutral": Settings, projects, search, and other pages
 */
const getDataMode = (page: string): "documents" | "journal" | "neutral" => {
	switch (page) {
		case "dashboard":
		case "document":
			return "documents";
		case "journal":
			return "journal";
		default:
			return "neutral";
	}
};

export const Layout: React.FC<LayoutProps> = ({
	sidebarTitle: _sidebarTitle,
	sidebarSections,
	sidebarContent,
	breadcrumb,
	currentPage,
	headerShortcuts = [],
	children,
	showCommandLine = false,
	commandContext = "YANTA",
	commandPlaceholder = "type command or press / for help",
	commandValue = "",
	onCommandChange,
	onCommandSubmit,
	commandInputRef: providedRef,
	onRegisterToggleSidebar,
}) => {
	const internalRef = useRef<HTMLInputElement>(null);
	const commandInputRef = providedRef || internalRef;
	const { executeGlobalCommand } = useGlobalCommand();
	const { success, error } = useNotification();
	const { checkAndWarnDeprecation } = useCommandDeprecation();
	const { sidebarVisible, toggleSidebar, isLoading: sidebarLoading } = useSidebarSetting();
	const { showFooterHints, isLoading: footerHintsLoading } = useFooterHintsSetting();
	const { currentProject } = useProjectContext();
	const { heightInRem } = useTitleBarContext();
	const { hints: footerHints } = useFooterHints({ currentPage });

	// Register the toggle sidebar handler with the parent component
	useEffect(() => {
		if (onRegisterToggleSidebar) {
			onRegisterToggleSidebar(() => {
				toggleSidebar();
			});
		}
	}, [onRegisterToggleSidebar, toggleSidebar]);

	const handleCommandSubmit = useCallback(
		async (command: string) => {
			// Show deprecation warning for :command syntax
			checkAndWarnDeprecation(command);

			const globalResult = await executeGlobalCommand(command);

			if (globalResult.handled) {
				if (globalResult.success) {
					if (globalResult.message) {
						success(globalResult.message);
					}
				} else {
					if (globalResult.message) {
						error(globalResult.message);
					}
				}

				if (onCommandChange) {
					onCommandChange("");
				}
				commandInputRef.current?.blur();
				return;
			}

			if (onCommandSubmit) {
				onCommandSubmit(command);
				commandInputRef.current?.blur();
			}
		},
		[executeGlobalCommand, onCommandSubmit, onCommandChange, success, error, commandInputRef, checkAndWarnDeprecation],
	);

	const sidebarToggleHotkeys = useMemo(
		() => [
			{
				key: "ctrl+b",
				handler: () => {
					toggleSidebar();
				},
				allowInInput: false,
				description: "Toggle sidebar",
				category: "navigation",
			},
			{
				key: "mod+e",
				handler: () => {
					toggleSidebar();
				},
				allowInInput: false,
				description: "Toggle sidebar",
				category: "navigation",
			},
		],
		[toggleSidebar],
	);

	useHotkeys(sidebarToggleHotkeys);

	const commandLineHotkeys = useMemo(
		() =>
			showCommandLine
				? [
						{
							key: "shift+;",
							handler: () => {
								if (commandInputRef.current) {
									commandInputRef.current.focus();
								}
							},
							allowInInput: false,
							description: "Focus command line",
							category: "navigation",
						},
						{
							key: "Escape",
							handler: (event: KeyboardEvent) => {
								const target = event.target as HTMLElement;
								if (target === commandInputRef.current) {
									event.preventDefault();
									event.stopPropagation();
									commandInputRef.current?.blur();
									if (onCommandChange) {
										onCommandChange("");
									}
									return true;
								}
								return false;
							},
							allowInInput: true,
							priority: 100,
							description: "Exit command line",
							capture: true,
							category: "navigation",
						},
					]
				: [],
		[showCommandLine, commandInputRef, onCommandChange],
	);

	useHotkeys(commandLineHotkeys);

	const dataMode = getDataMode(currentPage);

	return (
		<div
			data-testid="layout-root"
			data-sidebar-visible={sidebarVisible ? "true" : "false"}
			data-mode={dataMode}
			className="flex overflow-hidden font-mono text-sm leading-relaxed bg-bg text-text"
			style={{ height: `calc(100vh - ${heightInRem}rem)` }}
		>
			{/* Sidebar with CSS transition - always rendered for smooth animation */}
			<div
				className={`sidebar-transition ${
					!sidebarLoading && sidebarVisible ? "sidebar-visible" : "sidebar-hidden"
				}`}
			>
				{sidebarContent ? sidebarContent : <UISidebar sections={sidebarSections || []} />}
			</div>

			{/* Main content area with transition for smooth expansion when sidebar toggles */}
			<div className="flex flex-col flex-1 overflow-hidden main-content-transition">
				<HeaderBar
					breadcrumb={
						breadcrumb || (currentPage === "settings" ? "Settings" : currentProject?.name || "No Project")
					}
					currentPage={currentPage}
					shortcuts={headerShortcuts}
				/>

				{/* Context bar for content pages - shows mode, page name, project, and command hint */}
				{shouldShowContextBar(currentPage) && (
					<ContextBar
						mode={dataMode}
						pageName={getPageDisplayName(currentPage)}
						projectAlias={currentProject?.alias}
					/>
				)}

				<div className="flex-1 overflow-hidden">{children}</div>

				{showCommandLine && onCommandChange && (
					<CommandLine
						ref={commandInputRef}
						context={commandContext}
						placeholder={commandPlaceholder}
						value={commandValue}
						onChange={onCommandChange}
						onSubmit={handleCommandSubmit}
					/>
				)}
			</div>

			{/* Footer hint bar with context-aware keyboard shortcuts (only when enabled) */}
			{!footerHintsLoading && showFooterHints && (
				<FooterHintBar
					hints={footerHints}
					className={`footer-hint-bar-transition ${
						!sidebarLoading && sidebarVisible ? "footer-hint-bar-sidebar-visible" : ""
					}`}
				/>
			)}
		</div>
	);
};
