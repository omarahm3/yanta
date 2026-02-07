import { lazy } from "react";

// Keep Dashboard eager (initial route)
export { Dashboard } from "../dashboard";

// Lazy load all other routes for code splitting
export const Document = lazy(() => import("../document").then((m) => ({ default: m.Document })));
export const Projects = lazy(() => import("./Projects").then((m) => ({ default: m.Projects })));
export const Settings = lazy(() => import("../settings").then((m) => ({ default: m.Settings })));
export const Search = lazy(() => import("./Search").then((m) => ({ default: m.Search })));
export const Journal = lazy(() => import("../journal").then((m) => ({ default: m.Journal })));
export const QuickCapture = lazy(() =>
	import("../quick-capture").then((m) => ({ default: m.QuickCapture })),
);
