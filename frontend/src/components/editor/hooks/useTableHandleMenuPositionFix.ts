import { useEffect } from "react";

const MENU_CONFIGS = {
	"bn-table-handle-menu": { offset: { x: 0, y: 4 }, side: "bottom" as const },
	"bn-drag-handle-menu": { offset: { x: 8, y: 0 }, side: "right" as const },
};

type MenuClassName = keyof typeof MENU_CONFIGS;

/** Finds the nearest ancestor with a CSS transform and extracts its translation values. */
function getAncestorTransform(element: HTMLElement): { tx: number; ty: number } | null {
	let current = element.parentElement;

	while (current) {
		const { transform } = getComputedStyle(current);
		if (transform && transform !== "none") {
			const match = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([^,]+),\s*([^)]+)\)/);
			if (match) {
				return { tx: parseFloat(match[1]), ty: parseFloat(match[2]) };
			}
		}
		current = current.parentElement;
	}

	return null;
}

/** Positions a menu relative to its trigger, accounting for transformed ancestors. */
function positionMenu(className: MenuClassName): void {
	const { offset, side } = MENU_CONFIGS[className];

	const menu = document.querySelector(`.${className}[data-state="open"]`) as HTMLElement | null;
	if (!menu) return;

	const wrapper = menu.closest("[data-radix-popper-content-wrapper]") as HTMLElement | null;
	if (!wrapper) return;

	const menuId = menu.getAttribute("id");
	if (!menuId) return;

	const trigger = document.querySelector(`[aria-controls="${menuId}"]`) as HTMLElement | null;
	if (!trigger) return;

	const rect = trigger.getBoundingClientRect();
	const isBottom = side === "bottom";

	let left = (isBottom ? rect.left : rect.right) + offset.x;
	let top = (isBottom ? rect.bottom : rect.top) + offset.y;

	const ancestor = getAncestorTransform(wrapper);
	if (ancestor) {
		left -= ancestor.tx;
		top -= ancestor.ty;
	}

	wrapper.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; transform: none; min-width: max-content; z-index: 9999;`;
}

/**
 * Fixes BlockNote menu positioning when a CSS-transformed ancestor breaks Radix's Popper.
 *
 * BlockNote renders menus via createPortal outside the FloatingPortal where triggers live.
 * A parent's CSS transform creates a new containing block, causing incorrect positioning.
 * This hook detects menu opens and repositions them relative to the transformed ancestor.
 */
export function useTableHandleMenuPositionFix(): void {
	useEffect(() => {
		const observer = new MutationObserver((mutations) => {
			for (const { type, target, attributeName, addedNodes } of mutations) {
				if (type === "attributes" && attributeName === "data-state") {
					const el = target as HTMLElement;
					if (el.getAttribute("data-state") === "open") {
						for (const className of Object.keys(MENU_CONFIGS) as MenuClassName[]) {
							if (el.classList.contains(className)) {
								requestAnimationFrame(() => positionMenu(className));
								break;
							}
						}
					}
				}

				if (type === "childList") {
					for (const node of addedNodes) {
						if (!(node instanceof HTMLElement)) continue;
						for (const className of Object.keys(MENU_CONFIGS) as MenuClassName[]) {
							if (node.querySelector(`.${className}[data-state="open"]`)) {
								requestAnimationFrame(() => positionMenu(className));
							}
						}
					}
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
