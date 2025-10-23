import { useEffect, useRef } from "react";
import { useHotkeyContext } from "../contexts/HotkeyContext";
import { HotkeyConfig } from "../types/hotkeys";

export const useHotkey = (config: HotkeyConfig) => {
  const { register, unregister } = useHotkeyContext();
  const hotkeyIdRef = useRef<string | null>(null);
  const handlerRef = useRef(config.handler);

  useEffect(() => {
    handlerRef.current = config.handler;
  }, [config.handler]);

  useEffect(() => {
    if (hotkeyIdRef.current) {
      unregister(hotkeyIdRef.current);
    }

    const stableConfig = {
      ...config,
      handler: (event: KeyboardEvent) => handlerRef.current(event),
    };

    const id = register(stableConfig);
    hotkeyIdRef.current = id;

    return () => {
      if (hotkeyIdRef.current) {
        unregister(hotkeyIdRef.current);
      }
    };
  }, [config.key, config.allowInInput, config.capture, config.priority]);
};

export const useHotkeys = (configs: HotkeyConfig[]) => {
  const { register, unregister } = useHotkeyContext();
  const hotkeyIdsRef = useRef<string[]>([]);
  const handlerRefsRef = useRef<((event: KeyboardEvent) => void)[]>([]);

  useEffect(() => {
    handlerRefsRef.current = configs.map((c) => c.handler);
  }, [configs]);

  useEffect(() => {
    hotkeyIdsRef.current.forEach((id) => unregister(id));
    hotkeyIdsRef.current = [];

    const ids = configs.map((config, index) => {
      const stableConfig = {
        ...config,
        handler: (event: KeyboardEvent) =>
          handlerRefsRef.current[index]?.(event),
      };
      return register(stableConfig);
    });
    hotkeyIdsRef.current = ids;

    return () => {
      hotkeyIdsRef.current.forEach((id) => unregister(id));
    };
  }, [
    configs.length,
    configs.map((c) => c.key).join(","),
    configs.map((c) => c.allowInInput ?? false).join(","),
    configs.map((c) => c.capture ?? false).join(","),
    configs.map((c) => c.priority ?? 0).join(","),
  ]);
};
