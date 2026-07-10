import type React from "react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import {
	selectCanGoBack,
	selectCanGoForward,
	useNavHistoryStore,
} from "@/shared/stores/navHistory.store";
import { useSyncStore } from "@/shared/stores/sync.store";
import { useHotkeys } from "../hotkeys";
import { useProjectContext } from "../project";
import {
	getGlobalFooterHints,
	useFooterHints,
	useFooterHintsSetting,
	useGitStatus,
	useSidebarSetting,
} from "../shared/hooks";
import { useResponsive } from "../shared/hooks/useResponsive";
import type { PageName } from "../shared/types";
import {
	type BreadcrumbItem,
	FooterHintBar,
	GitStatusIndicator,
	HeaderBar,
	type SidebarSection,
	Sidebar as UISidebar,
} from "../shared/ui";
import { cn } from "../shared/utils/cn";
import { useTitleBarContext } from "./context";

function formatLastSync(timestamp: number): string {
	const diffMs = Date.now() - timestamp;
	const diffSec = Math.floor(diffMs / 1000);
	if (diffSec < 60) return "just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	return `${diffDays}d ago`;
}

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
	breadcrumbs?: BreadcrumbItem[];
	currentPage: PageName;
	headerShortcuts?: Array<{
		key: string;
		label: string;
	}>;
	headerActions?: ReactNode;
	children: ReactNode;
	onRegisterToggleSidebar?: (handler: () => void) => void;
	hasSelection?: boolean;
	documentCount?: number;
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
		if (seen.has(duplicateKey)) return false;
		seen.add(duplicateKey);
		return true;
	});
};

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
	breadcrumbs,
	currentPage,
	headerShortcuts = [],
	headerActions,
	children,
	onRegisterToggleSidebar,
	hasSelection,
	documentCount,
}) => {
	const { sidebarVisible, toggleSidebar, isLoading: sidebarLoading } = useSidebarSetting();
	const { showFooterHints, isLoading: footerHintsLoading } = useFooterHintsSetting();
	const { currentProject } = useProjectContext();
	const { heightInRem } = useTitleBarContext();
	const { hints: footerHints } = useFooterHints({ currentPage, hasSelection, documentCount });
	const { isBelowLg } = useResponsive();
	const canGoBack = useNavHistoryStore(selectCanGoBack);
	const canGoForward = useNavHistoryStore(selectCanGoForward);
	const { status: gitStatus, isLoading: gitStatusLoading } = useGitStatus(30_000);
	const syncInProgress = useSyncStore((s) => s.inProgress);
	const lastSynced = useSyncStore((s) => s.lastSynced);
	const goBack = useCallback(() => {
		if (typeof window !== "undefined" && useNavHistoryStore.getState().index > 0) {
			window.history.back();
		}
	}, []);
	const goForward = useCallback(() => {
		if (typeof window === "undefined") return;
		const { index, maxIndex } = useNavHistoryStore.getState();
		if (index < maxIndex) window.history.forward();
	}, []);

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

	const { shortcuts } = useMergedConfig();
	const sidebar = shortcuts.sidebar;

	const sidebarToggleHotkeys = useMemo(
		() => [
			{
				...sidebar.toggle,
				handler: () => {
					toggleSidebar();
				},
				allowInInput: false,
				category: "navigation",
			},
		],
		[toggleSidebar, sidebar],
	);

	useHotkeys(sidebarToggleHotkeys);

	const dataMode = getDataMode(currentPage);

	const contentRef = useRef<HTMLDivElement>(null);
	const currentProjectId = currentProject?.id;
	useEffect(() => {
		const el = contentRef.current;
		if (!el) return;
		el.classList.remove("animate-fade-in");
		void el.offsetWidth;
		el.classList.add("animate-fade-in");
	}, [currentProjectId]);

	const layoutStyle = useMemo(() => ({ height: `calc(100vh - ${heightInRem}rem)` }), [heightInRem]);

	// The sidebar (icon rail + sections panel) is shown when the persisted toggle
	// is on and the viewport is wide enough; it is force-collapsed on narrow
	// viewports where the content needs the full width. While the setting is still
	// loading we keep it shown to avoid a collapse flash on first paint.
	const effectiveSidebarVisible = sidebarVisible && !isBelowLg;
	const sidebarShown = sidebarLoading || effectiveSidebarVisible;

	return (
		<div
			data-testid="layout-root"
			data-sidebar-visible={sidebarShown ? "true" : "false"}
			data-mode={dataMode}
			className="layout-root relative flex overflow-hidden font-sans text-sm leading-relaxed bg-bg-dark text-text selection:bg-accent/30 selection:text-text-bright"
			style={layoutStyle}
		>
			<div
				className={cn(
					"sidebar-transition relative z-20 h-full",
					sidebarShown ? "sidebar-visible" : "sidebar-hidden",
				)}
			>
				{sidebarContent ? (
					sidebarContent
				) : (
					<UISidebar sections={sidebarSections || []} className="bg-surface border-r border-border" />
				)}
			</div>

			<div
				role="main"
				className="flex flex-col flex-1 overflow-hidden main-content-transition relative z-10 bg-bg"
			>
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:px-3 focus:py-2 focus:rounded-md focus:bg-accent focus:text-bg"
				>
					Skip to main content
				</a>
				{currentPage !== "settings" && (
					<div className="sticky top-0 z-40">
						<HeaderBar
							breadcrumbs={breadcrumbs}
							breadcrumb={breadcrumb || currentProject?.name || "No Project"}
							currentPage={getPageDisplayName(currentPage)}
							projectAlias={currentProject?.alias}
							shortcuts={headerShortcuts}
							headerActions={headerActions}
							onBack={goBack}
							onForward={goForward}
							canGoBack={canGoBack}
							canGoForward={canGoForward}
						/>
					</div>
				)}

				<div className="flex-1 overflow-hidden relative">
					<div
						ref={contentRef}
						id="main-content"
						className="h-full w-full overflow-y-auto overflow-x-hidden p-0 animate-fade-in scroll-smooth"
					>
						{children}
					</div>
				</div>

				{(!footerHintsLoading || gitStatus?.enabled) && (
					<div className="flex items-center justify-between min-h-8 bg-surface border-t border-border z-40">
						{!footerHintsLoading && showFooterHints && (
							<FooterHintBar hints={allFooterHints} className="flex-1 min-w-0 border-t-0 bg-transparent" />
						)}
						{gitStatus?.enabled && (
							<div className="flex items-center gap-2 px-3 shrink-0">
								{lastSynced && (
									<span className="text-xs text-text-dim">
										Last synced {formatLastSync(lastSynced.at)}
									</span>
								)}
								<GitStatusIndicator
									status={gitStatus}
									isLoading={gitStatusLoading || syncInProgress}
									compact
								/>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
