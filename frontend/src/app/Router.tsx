import React, { Suspense, useMemo } from "react";
import { Dashboard, Journal, Projects, QuickCapture, Search, Settings } from "../pages";
import type { NavigationState, PageName } from "../types";
import { PaneLayoutView } from "../components/pane";
import { LoadingSpinner } from "../components/ui";

const PageLoader = () => <LoadingSpinner message="Loading..." />;

const Test = React.lazy(() => import("../pages/Test").then((m) => ({ default: m.Test })));

interface RouterProps {
	currentPage?: string;
	navigationState?: NavigationState;
	onNavigate?: (page: string, state?: NavigationState) => void;
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
		(page: string, state?: NavigationState) => {
			if (onNavigate) {
				onNavigate(page, state);
			}
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
