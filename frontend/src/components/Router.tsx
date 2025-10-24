import React, { Suspense } from "react";
import { Dashboard, Document, Projects, Settings, Search } from "../pages";
import { LoadingSpinner } from "./ui";

const PageLoader = () => <LoadingSpinner message="Loading..." />;

const Test = React.lazy(() =>
  import("../pages/Test").then((m) => ({ default: m.Test })),
);

type Page =
  | "dashboard"
  | "document"
  | "projects"
  | "settings"
  | "search"
  | "test";

type NavigationState = Record<string, string | number | boolean | undefined>;

interface RouterProps {
  currentPage?: string;
  navigationState?: NavigationState;
  onNavigate?: (page: string, state?: NavigationState) => void;
  dashboardProps?: {
    onRegisterToggleArchived?: (handler: () => void) => void;
    getShowArchived?: () => boolean;
  };
}

export const Router: React.FC<RouterProps> = ({
  currentPage = "dashboard",
  navigationState = {},
  onNavigate,
  dashboardProps,
}) => {
  const handleNavigation = (page: string, state?: NavigationState) => {
    if (onNavigate) {
      onNavigate(page, state);
    }
  };

  const dashboardPropsWithNav = {
    onNavigate: handleNavigation,
    ...dashboardProps,
  };

  const projectsProps = {
    onNavigate: handleNavigation,
  };

  const settingsProps = {
    onNavigate: handleNavigation,
  };

  const searchProps = {
    onNavigate: handleNavigation,
  };

  const documentProps = {
    onNavigate: handleNavigation,
    documentPath: navigationState.documentPath as string | undefined,
    initialTitle: navigationState.initialTitle as string | undefined,
  };

  const page = currentPage as Page;

  const knownPages = new Set<Page>([
    "dashboard",
    "document",
    "projects",
    "settings",
    "search",
    "test",
  ]);

  return (
    <Suspense fallback={<PageLoader />}>
      {page === "dashboard" && <Dashboard {...dashboardPropsWithNav} />}
      {page === "document" && <Document {...documentProps} />}
      {page === "projects" && <Projects {...projectsProps} />}
      {page === "settings" && <Settings {...settingsProps} />}
      {page === "search" && <Search {...searchProps} />}
      {page === "test" && <Test onNavigate={handleNavigation} />}
      {!knownPages.has(page) && <Dashboard {...dashboardPropsWithNav} />}
    </Suspense>
  );
};
