import React, { lazy, Suspense, useMemo } from "react";
import { Dashboard } from "../dashboard";
import { PaneLayoutView } from "../pane";
import type { NavigationState, PageName } from "../shared/types";
import { LoadingSpinner } from "../shared/ui";

const PageLoader = () => <LoadingSpinner message="Loading..." />;

// Lazy load routes for code splitting
const Journal = lazy(() => import("../journal").then((m) => ({ default: m.Journal })));
const Projects = lazy(() => import("../project").then((m) => ({ default: m.Projects })));
const QuickCapture = lazy(() =>
	import("../quick-capture").then((m) => ({ default: m.QuickCapture })),
);
const Search = lazy(() => import("../search").then((m) => ({ default: m.Search })));
const Settings = lazy(() => import("../settings").then((m) => ({ default: m.Settings })));
const Test = lazy(() => import("./test/Test").then((m) => ({ default: m.Test })));

interface RouterProps {
	currentPage?: PageName;
	navigationState?: NavigationState;
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onRegisterToggleArchived?: (handler: () => void) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const defaultNavigationState: NavigationState = {};

export const Router: React.FC<RouterProps> = ({
	currentPage = "dashboard",
	navigationState = defaultNavigationState,
	onNavigate,
	onRegisterToggleArchived,
	onRegisterToggleSidebar,
}) => {
	const handleNavigation = React.useCallback(
		(page: PageName, state?: NavigationState) => {
			onNavigate?.(page, state);
		},
		[onNavigate],
	);

	const page = currentPage as PageName;

	const dashboardPropsWithNav = useMemo(
		() => ({
			onNavigate: handleNavigation,
			onRegisterToggleSidebar,
			onRegisterToggleArchived,
		}),
		[handleNavigation, onRegisterToggleSidebar, onRegisterToggleArchived],
	);

	const commonPageProps = useMemo(
		() => ({
			onNavigate: handleNavigation,
			onRegisterToggleSidebar,
		}),
		[handleNavigation, onRegisterToggleSidebar],
	);

	const paneLayoutViewProps = useMemo(
		() => ({
			onNavigate: handleNavigation,
			onRegisterToggleSidebar,
			documentPath: navigationState.documentPath as string | undefined,
		}),
		[handleNavigation, onRegisterToggleSidebar, navigationState.documentPath],
	);

	const journalProps = useMemo(
		() => ({
			onNavigate: handleNavigation,
			onRegisterToggleSidebar,
			initialDate: navigationState.date as string | undefined,
		}),
		[handleNavigation, onRegisterToggleSidebar, navigationState.date],
	);

	return (
		<Suspense fallback={<PageLoader />}>
			{page === "dashboard" && <Dashboard {...dashboardPropsWithNav} />}
			{page === "document" && <PaneLayoutView {...paneLayoutViewProps} />}
			{page === "projects" && <Projects {...commonPageProps} />}
			{page === "settings" && <Settings {...commonPageProps} />}
			{page === "search" && <Search {...commonPageProps} />}
			{page === "test" && <Test {...commonPageProps} />}
			{page === "quick-capture" && <QuickCapture />}
			{page === "journal" && <Journal {...journalProps} />}
			{!knownPages.has(page) && <Dashboard {...dashboardPropsWithNav} />}
		</Suspense>
	);
};

const knownPages = new Set<PageName>([
	"dashboard",
	"document",
	"projects",
	"settings",
	"search",
	"test",
	"quick-capture",
	"journal",
]);
