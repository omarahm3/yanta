import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Debug hook for the Test page: observes a container and logs file input
 * change/click events for all input[type="file"] elements (including dynamically added).
 */
export function useFileInputDebug(
	containerRef: RefObject<HTMLElement | null>,
	label: string,
): void {
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const trackedInputs = new Set<HTMLInputElement>();

		const handleChange = (event: Event) => {
			const input = event.currentTarget as HTMLInputElement;
			console.info(`[Test][${label}] change fired`, {
				accept: input.accept,
				files: input.files
					? Array.from(input.files).map((f) => ({
							name: f.name,
							type: f.type,
							size: f.size,
						}))
					: null,
			});
		};

		const handleClick = (event: Event) => {
			const input = event.currentTarget as HTMLInputElement;
			console.info(`[Test][${label}] click`, {
				accept: input.accept,
			});
		};

		const registerInput = (input: HTMLInputElement) => {
			if (trackedInputs.has(input)) return;
			trackedInputs.add(input);
			console.info(`[Test][${label}] file input registered`, {
				accept: input.accept,
				visibility: window.getComputedStyle(input).display,
			});
			input.addEventListener("change", handleChange);
			input.addEventListener("click", handleClick);
		};

		const unregisterAll = () => {
			trackedInputs.forEach((input) => {
				input.removeEventListener("change", handleChange);
				input.removeEventListener("click", handleClick);
			});
			trackedInputs.clear();
		};

		container.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(registerInput);

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLInputElement && node.type === "file") {
						registerInput(node);
					} else if (node instanceof HTMLElement) {
						node.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(registerInput);
					}
				});
			}
		});

		observer.observe(container, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			unregisterAll();
		};
	}, [containerRef, label]);
}
