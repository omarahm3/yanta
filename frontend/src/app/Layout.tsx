import type React from "react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { SIDEBAR_SHORTCUTS } from "@/config/public";
import { useHotkeys } from "../hotkeys";
import { useProjectContext } from "../project";
import {
	getGlobalFooterHints,
	useFooterHints,
	useFooterHintsSetting,
	useSidebarSetting,
} from "../shared/hooks";
import type { PageName } from "../shared/types";
import { FooterHintBar, HeaderBar, type SidebarSection, Sidebar as UISidebar } from "../shared/ui";
import { useTitleBarContext } from "./context";

/**
 * Converts the current page identifier to a display-friendly page name.
 */
const getPageDisplayName = (page: PageName): string => {
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
	currentPage: PageName;
	headerShortcuts?: Array<{
		key: string;
		label: string;
	}>;
	children: ReactNode;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const dedupeFooterHints = (
	hints: Array<{
		key: string;
		label: string;
		priority?: 1 | 2 | 3;
	}>,
) => {
	const seen = new Set<string>();

	return hints.filter((hint) => {
		const duplicateKey = `${hint.key}-${hint.label}`;
		if (seen.has(duplicateKey)) {
			return false;
		}
		seen.add(duplicateKey);
		return true;
	});
};

/**
 * Determines the mode based on the current page.
 * - "documents": Dashboard and document pages
 * - "journal": Journal page
 * - "neutral": Settings, projects, search, and other pages
 */
const getDataMode = (page: PageName): "documents" | "journal" | "neutral" => {
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
	// The command-palette and help affordances stay pinned on every page so a
	// first-timer can always discover them without docs (YANA-7).
	const allFooterHints = useMemo(
		() => dedupeFooterHints([...getGlobalFooterHints(), ...footerHints]),
		[footerHints],
	);

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

	// Replay the content fade as a deliberate cue when the active project changes.
	// We retrigger the existing CSS animation imperatively (no remount) so page
	// state is preserved; prefers-reduced-motion collapses it to an instant swap.
	const contentRef = useRef<HTMLDivElement>(null);
	const currentProjectId = currentProject?.id;
	useEffect(() => {
		const el = contentRef.current;
		if (!el) return;
		el.classList.remove("animate-fade-in");
		// Force a reflow so removing and re-adding the class restarts the animation.
		void el.offsetWidth;
		el.classList.add("animate-fade-in");
	}, [currentProjectId]);

	const layoutStyle = useMemo(() => ({ height: `calc(100vh - ${heightInRem}rem)` }), [heightInRem]);

	return (
		<div
			data-testid="layout-root"
			data-sidebar-visible={sidebarVisible ? "true" : "false"}
			data-mode={dataMode}
			className="layout-root relative flex overflow-hidden font-sans text-sm leading-relaxed bg-bg-dark text-text selection:bg-accent/30 selection:text-text-bright"
			style={layoutStyle}
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
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:px-3 focus:py-2 focus:rounded-md focus:bg-accent focus:text-bg"
				>
					Skip to main content
				</a>
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
					<div
						ref={contentRef}
						id="main-content"
						className="h-full w-full overflow-y-auto overflow-x-hidden p-0 animate-fade-in scroll-smooth"
					>
						{children}
					</div>
				</div>

				{!footerHintsLoading && showFooterHints && <FooterHintBar hints={allFooterHints} />}
			</div>
		</div>
	);
};
