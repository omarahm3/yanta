import type React from "react";
import { type ReactNode, useEffect, useMemo } from "react";
import {
	FooterHintBar,
	HeaderBar,
	type SidebarSection,
	Sidebar as UISidebar,
} from "../components/ui";
import { SIDEBAR_SHORTCUTS } from "../config";
import { useProjectContext, useTitleBarContext } from "../contexts";
import { useFooterHints, useFooterHintsSetting, useHotkeys, useSidebarSetting } from "../hooks";

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
	onRegisterToggleSidebar,
}) => {
	const { sidebarVisible, toggleSidebar, isLoading: sidebarLoading } = useSidebarSetting();
	const { showFooterHints, isLoading: footerHintsLoading } = useFooterHintsSetting();
	const { currentProject } = useProjectContext();
	const { heightInRem } = useTitleBarContext();
	const { hints: footerHints } = useFooterHints({ currentPage });

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
				...SIDEBAR_SHORTCUTS.toggle,
				handler: () => {
					toggleSidebar();
				},
				allowInInput: false,
				category: "navigation",
			},
		],
		[toggleSidebar],
	);

	useHotkeys(sidebarToggleHotkeys);

	const dataMode = getDataMode(currentPage);

	return (
		<div
			data-testid="layout-root"
			data-sidebar-visible={sidebarVisible ? "true" : "false"}
			data-mode={dataMode}
			className="relative flex overflow-hidden font-sans text-sm leading-relaxed bg-bg-dark text-text selection:bg-accent/30 selection:text-text-bright"
			style={{
				height: `calc(100vh - ${heightInRem}rem)`,
				backgroundImage:
					"radial-gradient(circle at 15% 50%, rgba(var(--color-accent), 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(var(--color-purple), 0.08), transparent 25%)",
			}}
		>
			{/* Glass Sidebar Container */}
			<div
				className={`sidebar-transition relative z-20 h-full ${
					!sidebarLoading && !sidebarVisible ? "sidebar-hidden" : "sidebar-visible"
				}`}
			>
				{sidebarContent ? (
					sidebarContent
				) : (
					<UISidebar
						sections={sidebarSections || []}
						className="bg-glass-bg/50 backdrop-blur-xl border-r border-glass-border"
					/>
				)}
			</div>

			<div className="flex flex-col flex-1 overflow-hidden main-content-transition relative z-10 bg-glass-bg/10 backdrop-blur-sm">
				{currentPage !== "settings" && (
					<div className="bg-glass-bg/40 backdrop-blur-md border-b border-glass-border sticky top-0 z-30">
						<HeaderBar
							breadcrumb={breadcrumb || currentProject?.name || "No Project"}
							currentPage={getPageDisplayName(currentPage)}
							projectAlias={currentProject?.alias}
							shortcuts={headerShortcuts}
						/>
					</div>
				)}

				<div className="flex-1 overflow-hidden relative">
					{/* Content Container with subtle inner shadow/depth */}
					<div className="h-full w-full overflow-y-auto overflow-x-hidden p-0 animate-fade-in scroll-smooth">
						{children}
					</div>
				</div>

				{!footerHintsLoading && showFooterHints && <FooterHintBar hints={footerHints} />}
			</div>
		</div>
	);
};
