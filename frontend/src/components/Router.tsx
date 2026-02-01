import React, { Suspense } from "react";
import { Dashboard, Document, Journal, Projects, QuickCapture, Search, Settings } from "../pages";
import { LoadingSpinner } from "./ui";

const PageLoader = () => <LoadingSpinner message="Loading..." />;

const Test = React.lazy(() => import("../pages/Test").then((m) => ({ default: m.Test })));

type Page =
	| "dashboard"
	| "document"
	| "projects"
	| "settings"
	| "search"
	| "test"
	| "quick-capture"
	| "journal";

type NavigationState = Record<string, string | number | boolean | undefined>;

interface RouterProps {
	currentPage?: string;
	navigationState?: NavigationState;
	onNavigate?: (page: string, state?: NavigationState) => void;
	dashboardProps?: {
		onRegisterToggleArchived?: (handler: () => void) => void;
		getShowArchived?: () => boolean;
	};
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const Router: React.FC<RouterProps> = ({
	currentPage = "dashboard",
	navigationState = {},
	onNavigate,
	dashboardProps,
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

	const dashboardPropsWithNav = {
		onNavigate: handleNavigation,
		onRegisterToggleSidebar,
		...dashboardProps,
	};

	const projectsProps = {
		onNavigate: handleNavigation,
		onRegisterToggleSidebar,
	};

	const settingsProps = {
		onNavigate: handleNavigation,
		onRegisterToggleSidebar,
	};

	const searchProps = {
		onNavigate: handleNavigation,
		onRegisterToggleSidebar,
	};

	const documentProps = {
		onNavigate: handleNavigation,
		onRegisterToggleSidebar,
		documentPath: navigationState.documentPath as string | undefined,
		initialTitle: navigationState.initialTitle as string | undefined,
	};

	const journalProps = {
		onNavigate: handleNavigation,
		onRegisterToggleSidebar,
		initialDate: navigationState.date as string | undefined,
	};

	const testProps = {
		onNavigate: handleNavigation,
		onRegisterToggleSidebar,
	};

	const page = currentPage as Page;

	const knownPages = new Set<Page>([
		"dashboard",
		"document",
		"projects",
		"settings",
		"search",
		"test",
		"quick-capture",
		"journal",
	]);

	return (
		<Suspense fallback={<PageLoader />}>
			{page === "dashboard" && <Dashboard {...dashboardPropsWithNav} />}
			{page === "document" && <Document {...documentProps} />}
			{page === "projects" && <Projects {...projectsProps} />}
			{page === "settings" && <Settings {...settingsProps} />}
			{page === "search" && <Search {...searchProps} />}
			{page === "test" && <Test {...testProps} />}
			{page === "quick-capture" && <QuickCapture />}
			{page === "journal" && <Journal {...journalProps} />}
			{!knownPages.has(page) && <Dashboard {...dashboardPropsWithNav} />}
		</Suspense>
	);
};
