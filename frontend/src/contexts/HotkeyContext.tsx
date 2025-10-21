import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { useHotkeys } from "@mantine/hooks";
import {
  HotkeyConfig,
  RegisteredHotkey,
  HotkeyContextValue,
} from "../types/hotkeys";

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

export const HotkeyProvider: React.FC<HotkeyProviderProps> = ({ children }) => {
  const [hotkeys, setHotkeys] = useState<Map<string, RegisteredHotkey>>(
    new Map(),
  );
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

  const specialCharHotkeys = Array.from(hotkeys.values()).filter(
    (h) =>
      h.key === "?" ||
      h.key === ":" ||
      h.key === "shift+;" ||
      h.key === "shift+/",
  );

  const hotkeysByKey = new Map<string, RegisteredHotkey[]>();
  Array.from(hotkeys.values())
    .filter((h) => !specialCharHotkeys.includes(h))
    .forEach((hotkey) => {
      const existing = hotkeysByKey.get(hotkey.key) || [];
      existing.push(hotkey);
      hotkeysByKey.set(hotkey.key, existing);
    });

  const mantineCompatibleHotkeys = Array.from(hotkeysByKey.entries()).map(
    ([key, handlers]) => {
      const wrappedHandler = (event: KeyboardEvent) => {
        const activeElement = document.activeElement;
        const inInputField =
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA" ||
          activeElement?.getAttribute("contenteditable") === "true";

        const sortedHandlers = [...handlers].sort(
          (a, b) => (b.priority || 0) - (a.priority || 0),
        );

        for (const hotkey of sortedHandlers) {
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

      return [key, wrappedHandler] as [string, (e: KeyboardEvent) => void];
    },
  );

  useHotkeys(mantineCompatibleHotkeys);

  useEffect(() => {
    const handleSpecialChars = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const inInputField =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true";

      for (const hotkey of specialCharHotkeys) {
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
  }, [specialCharHotkeys]);

  useEffect(() => {
    const handleSpaceKey = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const inInputField =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true";

      if (event.key === " " && !inInputField) {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleSpaceKey);
    return () => document.removeEventListener("keydown", handleSpaceKey);
  }, []);

  useEffect(() => {
    const handleCtrlW = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const inInputField =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA";

      if (inInputField && event.ctrlKey && event.key === "w") {
        event.preventDefault();
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        const cursorPos = target.selectionStart || 0;

        if (cursorPos === 0) return;

        const value = target.value;
        const textBeforeCursor = value.substring(0, cursorPos);
        const wordMatch = textBeforeCursor.match(/\S+\s*$/);

        if (wordMatch) {
          const deleteLength = wordMatch[0].length;
          const newValue =
            textBeforeCursor.substring(
              0,
              textBeforeCursor.length - deleteLength,
            ) + value.substring(cursorPos);

          if (target instanceof HTMLInputElement && nativeInputValueSetter) {
            nativeInputValueSetter.call(target, newValue);
          } else if (
            target instanceof HTMLTextAreaElement &&
            nativeTextAreaValueSetter
          ) {
            nativeTextAreaValueSetter.call(target, newValue);
          }

          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.setSelectionRange(
            textBeforeCursor.length - deleteLength,
            textBeforeCursor.length - deleteLength,
          );
        }
      }
    };

    document.addEventListener("keydown", handleCtrlW);
    return () => document.removeEventListener("keydown", handleCtrlW);
  }, []);

  const value: HotkeyContextValue = {
    register,
    unregister,
    getRegisteredHotkeys,
  };

  return (
    <HotkeyContext.Provider value={value}>{children}</HotkeyContext.Provider>
  );
};

export const useHotkeyContext = (): HotkeyContextValue => {
  const context = useContext(HotkeyContext);
  if (!context) {
    throw new Error("useHotkeyContext must be used within a HotkeyProvider");
  }
  return context;
};
