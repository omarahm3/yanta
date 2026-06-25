import { useEffect } from "react";
import type { NavigationState, PageName } from "../../shared/types";

const LEADER = "g";
const SEQUENCE_TIMEOUT_MS = 900;

/** Vim-style destinations reachable via the `g` leader prefix. */
const DESTINATIONS: Record<string, PageName> = {
	d: "dashboard",
	j: "journal",
	s: "search",
	p: "projects",
	",": "settings",
};

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export interface UseLeaderKeysOptions {
	onNavigate: (page: PageName, state?: NavigationState) => void;
	enabled?: boolean;
}

/**
 * Vim-style leader-key navigation: press `g`, then a destination key, to jump.
 *
 *   g d → documents · g j → journal · g s → search · g p → projects · g , → settings
 *
 * The handler runs in the capture phase and stops propagation once it resolves a
 * sequence, so the consumed second key (e.g. `j`) never also triggers list
 * navigation underneath. Sequences started while a field is focused are ignored,
 * and an unfinished sequence disarms after {@link SEQUENCE_TIMEOUT_MS}.
 */
export function useLeaderKeys({ onNavigate, enabled = true }: UseLeaderKeysOptions): void {
	useEffect(() => {
		if (!enabled) return;

		let armed = false;
		let timer: number | undefined;

		const disarm = () => {
			armed = false;
			if (timer !== undefined) {
				window.clearTimeout(timer);
				timer = undefined;
			}
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
				disarm();
				return;
			}
			if (isEditableTarget(event.target)) {
				disarm();
				return;
			}

			if (!armed) {
				if (event.key === LEADER) {
					armed = true;
					if (timer !== undefined) window.clearTimeout(timer);
					timer = window.setTimeout(disarm, SEQUENCE_TIMEOUT_MS);
				}
				return;
			}

			// A leader sequence is in progress — resolve the second key.
			const page = DESTINATIONS[event.key.toLowerCase()];
			disarm();
			if (page) {
				event.preventDefault();
				event.stopImmediatePropagation();
				onNavigate(page);
			}
		};

		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () => {
			window.removeEventListener("keydown", onKeyDown, { capture: true });
			disarm();
		};
	}, [onNavigate, enabled]);
}
