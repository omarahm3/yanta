import type React from "react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useProjectContext, useTitleBarContext } from "../contexts";
import {
	useFooterHints,
	useFooterHintsSetting,
	useHotkeys,
	useQuickCreate,
	useSidebarSetting,
} from "../hooks";
import { ContextBar, FooterHintBar, HeaderBar, QuickCreateInput, type SidebarSection, Sidebar as UISidebar } from "./ui";

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
	/** Show the QuickCreateInput at the bottom of the layout */
	showQuickCreate?: boolean;
	/** Callback when navigation is needed after document creation */
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	/** Reference to the QuickCreateInput element for focus management */
	quickCreateInputRef?: React.RefObject<HTMLInputElement>;
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
	showQuickCreate = false,
	onNavigate,
	quickCreateInputRef: providedRef,
	onRegisterToggleSidebar,
}) => {
	const internalRef = useRef<HTMLInputElement>(null);
	const quickCreateInputRef = providedRef || internalRef;
	const { sidebarVisible, toggleSidebar, isLoading: sidebarLoading } = useSidebarSetting();
	const { showFooterHints, isLoading: footerHintsLoading } = useFooterHintsSetting();
	const { currentProject } = useProjectContext();
	const { heightInRem } = useTitleBarContext();
	const { hints: footerHints } = useFooterHints({ currentPage });
	const { handleCreateDocument, handleCreateJournalEntry, currentProjectAlias, isDisabled } = useQuickCreate({ onNavigate });

	// Register the toggle sidebar handler with the parent component
	useEffect(() => {
		if (onRegisterToggleSidebar) {
			onRegisterToggleSidebar(() => {
				toggleSidebar();
			});
		}
	}, [onRegisterToggleSidebar, toggleSidebar]);

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

	const quickCreateHotkeys = useMemo(
		() =>
			showQuickCreate
				? [
						{
							key: "Escape",
							handler: (event: KeyboardEvent) => {
								const target = event.target as HTMLElement;
								if (target === quickCreateInputRef.current) {
									event.preventDefault();
									event.stopPropagation();
									quickCreateInputRef.current?.blur();
									return true;
								}
								return false;
							},
							allowInInput: true,
							priority: 100,
							description: "Exit quick create input",
							capture: true,
							category: "navigation",
						},
					]
				: [],
		[showQuickCreate, quickCreateInputRef],
	);

	useHotkeys(quickCreateHotkeys);

	const dataMode = getDataMode(currentPage);

	return (
		<div
			data-testid="layout-root"
			data-sidebar-visible={sidebarVisible ? "true" : "false"}
			data-mode={dataMode}
			className="flex overflow-hidden font-mono text-sm leading-relaxed bg-bg text-text"
			style={{ height: `calc(100vh - ${heightInRem}rem)` }}
		>
			<div
				className={`sidebar-transition h-full ${
					!sidebarLoading && sidebarVisible ? "sidebar-visible" : "sidebar-hidden"
				}`}
			>
				{sidebarContent ? sidebarContent : <UISidebar sections={sidebarSections || []} />}
			</div>

			<div className="flex flex-col flex-1 overflow-hidden main-content-transition">
				<HeaderBar
					breadcrumb={
						breadcrumb || (currentPage === "settings" ? "Settings" : currentProject?.name || "No Project")
					}
					currentPage={currentPage}
					shortcuts={headerShortcuts}
				/>

				{shouldShowContextBar(currentPage) && (
					<ContextBar
						mode={dataMode}
						pageName={getPageDisplayName(currentPage)}
						projectAlias={currentProject?.alias}
					/>
				)}

				<div className="flex-1 overflow-hidden">{children}</div>

				{showQuickCreate && (
					<QuickCreateInput
						ref={quickCreateInputRef}
						projectAlias={currentProjectAlias ?? ""}
						onCreateDocument={handleCreateDocument}
						onCreateJournalEntry={handleCreateJournalEntry}
						disabled={isDisabled}
					/>
				)}
			</div>

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
