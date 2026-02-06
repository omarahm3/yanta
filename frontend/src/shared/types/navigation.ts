export type PageName =
	| "dashboard"
	| "document"
	| "projects"
	| "settings"
	| "search"
	| "test"
	| "quick-capture"
	| "journal";

export type NavigationState = Record<string, string | number | boolean | undefined>;
