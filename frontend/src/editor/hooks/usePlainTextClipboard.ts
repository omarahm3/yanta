import { useCallback, useEffect, useRef } from "react";

/**
 * Options for the plain text clipboard hook.
 */
export interface UsePlainTextClipboardOptions {
	/**
	 * Whether the clipboard override is enabled.
	 * When false, the hook does nothing and the default BlockNote
	 * markdown serialization is used.
	 * @default true
	 */
	enabled?: boolean;
}

/**
 * Hook that overrides BlockNote's default clipboard behavior to copy
 * the visual/rendered text instead of markdown syntax.
 *
 * By default, BlockNote serializes copied content to markdown for the
 * `text/plain` clipboard format. This means links like "Click here"
 * become `[Click here](url)` and bare URLs become `<https://url>`.
 *
 * This hook intercepts the copy event and replaces the `text/plain`
 * content with the actual visual text from `window.getSelection()`,
 * matching the behavior of Notion and Obsidian.
 *
 * @param container - The container element to attach the copy listener to.
 *                    If null, the hook does nothing.
 * @param options - Configuration options for the hook.
 *
 * @example
 * ```tsx
 * const [container, setContainer] = useState<HTMLDivElement | null>(null);
 * usePlainTextClipboard(container);
 *
 * return <div ref={setContainer}>...</div>;
 * ```
 *
 * @see https://github.com/TypeCellOS/BlockNote/issues/1097
 */
export function usePlainTextClipboard(
	container: HTMLElement | null,
	options: UsePlainTextClipboardOptions = {},
): void {
	const { enabled = true } = options;
	const containerRef = useRef<HTMLElement | null>(null);
	containerRef.current = container;

	const handleCopy = useCallback((event: ClipboardEvent) => {
		if (!containerRef.current) {
			return;
		}

		const target = event.target as Node | null;
		if (!target || !containerRef.current.contains(target)) {
			return;
		}

		if (!event.clipboardData) {
			return;
		}

		const selection = window.getSelection();
		if (!selection || selection.isCollapsed) {
			return;
		}

		const selectedText = selection.toString();
		if (!selectedText) {
			return;
		}

		event.clipboardData.setData("text/plain", selectedText);
	}, []);

	useEffect(() => {
		if (!container || !enabled) {
			return;
		}

		document.addEventListener("copy", handleCopy);

		return () => {
			document.removeEventListener("copy", handleCopy);
		};
	}, [container, enabled, handleCopy]);
}
