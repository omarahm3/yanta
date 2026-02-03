import { useCallback, useRef } from "react";
import { useNotification } from "./useNotification";

const STORAGE_KEY = "yanta_command_line_deprecation_warned";
const SESSION_STORAGE_KEY = "yanta_command_line_deprecation_session";

/**
 * Mapping of deprecated :commands to their command palette equivalents.
 */
export const DEPRECATED_COMMAND_MAPPINGS: Record<
	string,
	{ paletteAction: string; shortcut?: string }
> = {
	sync: { paletteAction: "Git Sync", shortcut: "Ctrl+K" },
	new: { paletteAction: "New Document", shortcut: "Ctrl+N" },
	"new-doc": { paletteAction: "New Document", shortcut: "Ctrl+N" },
	open: { paletteAction: "Open Document", shortcut: "Ctrl+K" },
	search: { paletteAction: "Search", shortcut: "Ctrl+K" },
	archive: { paletteAction: "Archive Document", shortcut: "Ctrl+K" },
	delete: { paletteAction: "Delete Document", shortcut: "Ctrl+K" },
	export: { paletteAction: "Export Document", shortcut: "Ctrl+K" },
	"export-md": { paletteAction: "Export as Markdown", shortcut: "Ctrl+K" },
	"export-pdf": { paletteAction: "Export as PDF", shortcut: "Ctrl+K" },
	switch: { paletteAction: "Switch Project", shortcut: "Ctrl+K" },
	settings: { paletteAction: "Open Settings", shortcut: "Ctrl+K" },
	help: { paletteAction: "Show Help", shortcut: "?" },
	quit: { paletteAction: "Quit", shortcut: "Ctrl+Q" },
};

/**
 * Checks if this is the first time showing the deprecation warning in this session.
 */
const isFirstWarningInSession = (): boolean => {
	try {
		return sessionStorage.getItem(SESSION_STORAGE_KEY) !== "shown";
	} catch {
		return true;
	}
};

/**
 * Marks that the full deprecation warning has been shown in this session.
 */
const markSessionWarningShown = (): void => {
	try {
		sessionStorage.setItem(SESSION_STORAGE_KEY, "shown");
	} catch {
		// Session storage not available
	}
};

/**
 * Checks if the user has ever been shown the deprecation warning.
 */
const hasEverSeenWarning = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === "true";
	} catch {
		return false;
	}
};

/**
 * Marks that the user has seen the deprecation warning at least once.
 */
const markWarningEverSeen = (): void => {
	try {
		localStorage.setItem(STORAGE_KEY, "true");
	} catch {
		// Local storage not available
	}
};

export interface UseCommandDeprecationReturn {
	/**
	 * Checks if a command starts with ':' and shows appropriate deprecation warning.
	 * Returns true if a deprecation warning was shown (command is deprecated).
	 */
	checkAndWarnDeprecation: (command: string) => boolean;

	/**
	 * Gets the palette equivalent for a deprecated command.
	 */
	getPaletteEquivalent: (
		command: string,
	) => { paletteAction: string; shortcut?: string } | undefined;
}

/**
 * Hook for managing command line deprecation warnings.
 *
 * This hook tracks whether users have seen the deprecation warning for :command syntax
 * and provides methods to check commands and show appropriate warnings.
 */
export const useCommandDeprecation = (): UseCommandDeprecationReturn => {
	const { info } = useNotification();
	const lastWarnedCommandRef = useRef<string>("");

	/**
	 * Extract the base command from a :command string.
	 * E.g., ":sync" -> "sync", ":new my-doc" -> "new"
	 */
	const extractBaseCommand = useCallback((command: string): string | null => {
		const trimmed = command.trim();
		if (!trimmed.startsWith(":")) {
			return null;
		}
		const withoutPrefix = trimmed.slice(1).trim();
		const baseCommand = withoutPrefix.split(/\s+/)[0]?.toLowerCase();
		return baseCommand || null;
	}, []);

	const getPaletteEquivalent = useCallback(
		(command: string): { paletteAction: string; shortcut?: string } | undefined => {
			const baseCommand = extractBaseCommand(command);
			if (!baseCommand) {
				return undefined;
			}
			return DEPRECATED_COMMAND_MAPPINGS[baseCommand];
		},
		[extractBaseCommand],
	);

	const checkAndWarnDeprecation = useCallback(
		(command: string): boolean => {
			const trimmed = command.trim();

			// Only warn for commands starting with ':'
			if (!trimmed.startsWith(":")) {
				return false;
			}

			const baseCommand = extractBaseCommand(trimmed);
			if (!baseCommand) {
				return false;
			}

			// Don't warn for the same command repeatedly
			if (lastWarnedCommandRef.current === baseCommand) {
				return true;
			}
			lastWarnedCommandRef.current = baseCommand;

			const mapping = DEPRECATED_COMMAND_MAPPINGS[baseCommand];
			const isFirstInSession = isFirstWarningInSession();
			const hasSeenBefore = hasEverSeenWarning();

			if (isFirstInSession || !hasSeenBefore) {
				// Show full deprecation message
				if (mapping) {
					info(
						`Tip: Use Ctrl+K → ${mapping.paletteAction} instead. The :command syntax will be removed in a future update.`,
						{ duration: 6000 },
					);
				} else {
					info(
						"Tip: Use Ctrl+K to access commands. The :command syntax will be removed in a future update.",
						{ duration: 6000 },
					);
				}
				markSessionWarningShown();
				markWarningEverSeen();
			} else {
				// Show shorter reminder for subsequent uses
				if (mapping?.shortcut) {
					info(`Tip: Try ${mapping.shortcut} → ${mapping.paletteAction}`, { duration: 3000 });
				} else {
					info("Tip: Try Ctrl+K", { duration: 3000 });
				}
			}

			return true;
		},
		[extractBaseCommand, info],
	);

	return {
		checkAndWarnDeprecation,
		getPaletteEquivalent,
	};
};
