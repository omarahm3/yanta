import { type HotkeyItem, useHotkeys } from "@mantine/hooks";
import type React from "react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { HotkeyConfig, HotkeyContextValue, RegisteredHotkey } from "../types/hotkeys";
import { useDialog } from "./DialogContext";

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

interface HotkeyProviderProps {
	children: ReactNode;
}

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
	window.HTMLInputElement.prototype,
	"value",
)?.set;

const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
	window.HTMLTextAreaElement.prototype,
	"value",
)?.set;

const SPECIAL_KEY_SET = new Set(["?", ":", "shift+;", "shift+/"]);

const isMacPlatform = () =>
	typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const createHotkeyMatcher = (combo: string) => {
	const parts = combo
		.split("+")
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);

	let requireKey: string | null = null;
	let requireCtrl = false;
	let requireMeta = false;
	let requireAlt = false;
	let requireShift = false;

	parts.forEach((part) => {
		switch (part) {
			case "mod":
				if (isMacPlatform()) {
					requireMeta = true;
				} else {
					requireCtrl = true;
				}
				break;
			case "ctrl":
			case "control":
				requireCtrl = true;
				break;
			case "cmd":
			case "command":
			case "meta":
				requireMeta = true;
				break;
			case "alt":
			case "option":
				requireAlt = true;
				break;
			case "shift":
				requireShift = true;
				break;
			default:
				requireKey = part;
				break;
		}
	});

	return (event: KeyboardEvent) => {
		const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();

		if (requireKey && key !== requireKey) {
			return false;
		}

		if (event.ctrlKey !== requireCtrl) return false;
		if (event.metaKey !== requireMeta) return false;
		if (event.altKey !== requireAlt) return false;
		if (event.shiftKey !== requireShift) return false;

		return true;
	};
};

export const HotkeyProvider: React.FC<HotkeyProviderProps> = ({ children }) => {
	const { isDialogOpen } = useDialog();
	const [hotkeys, setHotkeys] = useState<Map<string, RegisteredHotkey>>(new Map());
	const nextIdRef = useRef(0);

	const register = useCallback((config: HotkeyConfig): string => {
		const id = `hotkey-${nextIdRef.current}`;
		nextIdRef.current += 1;

		const registeredHotkey: RegisteredHotkey = {
			id,
			...config,
		};

		setHotkeys((prev) => {
			const updated = new Map(prev);
			updated.set(id, registeredHotkey);
			return updated;
		});

		return id;
	}, []);

	const unregister = useCallback((id: string) => {
		setHotkeys((prev) => {
			const updated = new Map(prev);
			updated.delete(id);
			return updated;
		});
	}, []);

	const getRegisteredHotkeys = useCallback((): RegisteredHotkey[] => {
		return Array.from(hotkeys.values());
	}, [hotkeys]);

	const { bubbleHotkeyEntries, captureHotkeysWithMatchers, specialCharHotkeys } = useMemo(() => {
		const captureMap = new Map<string, RegisteredHotkey[]>();
		const bubbleMap = new Map<string, RegisteredHotkey[]>();
		const special: RegisteredHotkey[] = [];

		hotkeys.forEach((hotkey) => {
			if (SPECIAL_KEY_SET.has(hotkey.key)) {
				special.push(hotkey);
				return;
			}

			const targetMap = hotkey.capture ? captureMap : bubbleMap;
			const list = targetMap.get(hotkey.key) ?? [];
			list.push(hotkey);
			targetMap.set(hotkey.key, list);
		});

		const mapToEntries = (map: Map<string, RegisteredHotkey[]>): HotkeyItem[] =>
			Array.from(map.entries()).map(([key, handlers]) => {
				const wrappedHandler = (event: KeyboardEvent) => {
					const target = event.target as HTMLElement | null;
					const inInputField =
						target?.tagName === "INPUT" ||
						target?.tagName === "TEXTAREA" ||
						(target?.getAttribute && target.getAttribute("contenteditable") === "true");

					if (isDialogOpen) {
						return;
					}

					const sortedHandlers = [...handlers].sort((a, b) => (b.priority || 0) - (a.priority || 0));

					for (const handler of sortedHandlers) {
						if (inInputField && !handler.allowInInput) {
							continue;
						}

						const result = handler.handler(event);
						if (result === false) {
							continue;
						}
						break;
					}
				};

				return [key, wrappedHandler] as HotkeyItem;
			});

		const captureHotkeysWithMatchers = Array.from(captureMap.entries())
			.flatMap(([key, handlers]) =>
				handlers.map((hotkey) => ({
					hotkey,
					matcher: createHotkeyMatcher(key),
				})),
			)
			.sort((a, b) => (b.hotkey.priority || 0) - (a.hotkey.priority || 0));

		return {
			bubbleHotkeyEntries: mapToEntries(bubbleMap),
			captureHotkeysWithMatchers,
			specialCharHotkeys: special,
		};
	}, [hotkeys, isDialogOpen]);

	useHotkeys(isDialogOpen ? [] : bubbleHotkeyEntries);

	useEffect(() => {
		if (captureHotkeysWithMatchers.length === 0) {
			return;
		}

		const handleCapture = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const inInputField =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				(target?.getAttribute && target.getAttribute("contenteditable") === "true");

			if (isDialogOpen) {
				return;
			}

			for (const { hotkey, matcher } of captureHotkeysWithMatchers) {
				if (!matcher(event)) {
					continue;
				}

				if (inInputField && !hotkey.allowInInput) {
					continue;
				}

				const result = hotkey.handler(event);
				if (result === false) {
					continue;
				}
				break;
			}
		};

		window.addEventListener("keydown", handleCapture, true);
		return () => {
			window.removeEventListener("keydown", handleCapture, true);
		};
	}, [captureHotkeysWithMatchers, isDialogOpen]);

	useEffect(() => {
		const handleSpecialChars = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const inInputField =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				(target?.getAttribute && target.getAttribute("contenteditable") === "true");

			if (isDialogOpen) {
				return;
			}

			for (const hotkey of specialCharHotkeys) {
				if (hotkey.capture) {
					continue;
				}

				const matches =
					(hotkey.key === "?" && event.key === "?") ||
					(hotkey.key === ":" && event.key === ":") ||
					(hotkey.key === "shift+;" && event.key === ":" && event.shiftKey) ||
					(hotkey.key === "shift+/" && event.key === "?" && event.shiftKey);

				if (matches) {
					if (inInputField && !hotkey.allowInInput) {
						continue;
					}

					event.preventDefault();
					hotkey.handler(event);
					break;
				}
			}
		};

		document.addEventListener("keydown", handleSpecialChars);
		return () => document.removeEventListener("keydown", handleSpecialChars);
	}, [specialCharHotkeys, isDialogOpen]);

	useEffect(() => {
		const handleSpaceKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const inInputField =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				(target?.getAttribute && target.getAttribute("contenteditable") === "true");

			const isInteractiveElement =
				target?.tagName === "BUTTON" ||
				target?.tagName === "A" ||
				target?.getAttribute?.("role") === "button" ||
				target?.getAttribute?.("role") === "checkbox";

			if (isDialogOpen) {
				return;
			}

			if (event.key === " " && !inInputField && !isInteractiveElement) {
				event.preventDefault();
			}
		};

		document.addEventListener("keydown", handleSpaceKey);
		return () => document.removeEventListener("keydown", handleSpaceKey);
	}, [isDialogOpen]);

	useEffect(() => {
		const handleCtrlW = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement;
			const inInputField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

			if (isDialogOpen) {
				return;
			}

			if (inInputField && event.ctrlKey && event.key === "w") {
				event.preventDefault();
				const inputTarget = target as HTMLInputElement | HTMLTextAreaElement;
				const cursorPos = inputTarget.selectionStart || 0;

				if (cursorPos === 0) return;

				const value = inputTarget.value;
				const textBeforeCursor = value.substring(0, cursorPos);
				const wordMatch = textBeforeCursor.match(/\S+\s*$/);

				if (wordMatch) {
					const deleteLength = wordMatch[0].length;
					const newValue =
						textBeforeCursor.substring(0, textBeforeCursor.length - deleteLength) +
						value.substring(cursorPos);

					if (inputTarget instanceof HTMLInputElement && nativeInputValueSetter) {
						nativeInputValueSetter.call(inputTarget, newValue);
					} else if (inputTarget instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
						nativeTextAreaValueSetter.call(inputTarget, newValue);
					}

					inputTarget.dispatchEvent(new Event("input", { bubbles: true }));
					inputTarget.setSelectionRange(
						textBeforeCursor.length - deleteLength,
						textBeforeCursor.length - deleteLength,
					);
				}
			}
		};

		document.addEventListener("keydown", handleCtrlW);
		return () => document.removeEventListener("keydown", handleCtrlW);
	}, [isDialogOpen]);

	const value: HotkeyContextValue = {
		register,
		unregister,
		getRegisteredHotkeys,
	};

	return <HotkeyContext.Provider value={value}>{children}</HotkeyContext.Provider>;
};

export const useHotkeyContext = (): HotkeyContextValue => {
	const context = useContext(HotkeyContext);
	if (!context) {
		throw new Error("useHotkeyContext must be used within a HotkeyProvider");
	}
	return context;
};
