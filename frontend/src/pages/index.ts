import { lazy } from "react";

// Keep Dashboard eager (initial route)
export { Dashboard } from "./Dashboard";

// Lazy load all other routes for code splitting
export const Document = lazy(() => import("./Document").then((m) => ({ default: m.Document })));
export const Projects = lazy(() => import("./Projects").then((m) => ({ default: m.Projects })));
export const Settings = lazy(() => import("./Settings").then((m) => ({ default: m.Settings })));
export const Search = lazy(() => import("./Search").then((m) => ({ default: m.Search })));
