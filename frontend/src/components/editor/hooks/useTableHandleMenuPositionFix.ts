import { useEffect } from "react";

/**
 * Hook to fix table handle menu positioning in BlockNote.
 *
 * ROOT CAUSE:
 * BlockNote renders the TableHandleMenu via React's createPortal to a menuContainer that's
 * OUTSIDE the FloatingPortal where the trigger button lives. This breaks Radix's Popper
 * positioning because the anchor (trigger) is in a different DOM location than expected.
 * The menu renders with transform: translate(0, -200%) which hides it off-screen.
 *
 * THE FIX:
 * Uses MutationObserver to detect when the menu opens and manually positions it
 * based on the trigger button's location.
 */
export function useTableHandleMenuPositionFix() {
	useEffect(() => {
		const positionMenu = (menuWrapper: HTMLElement) => {
			const menu = menuWrapper.querySelector(".bn-table-handle-menu");
			if (!menu) return;

			const menuId = menu.getAttribute("id");
			if (!menuId) return;

			const trigger = document.querySelector(`[aria-controls="${menuId}"]`) as HTMLElement;
			if (!trigger) return;

			const triggerRect = trigger.getBoundingClientRect();
			menuWrapper.style.transform = "none";
			menuWrapper.style.left = `${triggerRect.left}px`;
			menuWrapper.style.top = `${triggerRect.bottom + 4}px`;
		};

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "attributes" && mutation.attributeName === "data-state") {
					const target = mutation.target as HTMLElement;
					if (
						target.classList.contains("bn-table-handle-menu") &&
						target.getAttribute("data-state") === "open"
					) {
						const wrapper = target.closest("[data-radix-popper-content-wrapper]") as HTMLElement;
						if (wrapper) {
							requestAnimationFrame(() => positionMenu(wrapper));
						}
					}
				}

				if (mutation.type === "childList") {
					mutation.addedNodes.forEach((node) => {
						if (node instanceof HTMLElement) {
							const wrapper = node.matches("[data-radix-popper-content-wrapper]")
								? node
								: node.querySelector("[data-radix-popper-content-wrapper]");
							if (wrapper?.querySelector('.bn-table-handle-menu[data-state="open"]')) {
								requestAnimationFrame(() => positionMenu(wrapper as HTMLElement));
							}
						}
					});
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-state"],
		});

		return () => observer.disconnect();
	}, []);
}
