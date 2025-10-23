export interface HotkeyConfig {
  key: string;
  handler: (event: KeyboardEvent) => void | boolean;
  allowInInput?: boolean;
  description?: string;
  priority?: number;
  capture?: boolean;
}

export interface RegisteredHotkey extends HotkeyConfig {
  id: string;
}

export interface HotkeyContextValue {
  register: (config: HotkeyConfig) => string;
  unregister: (id: string) => void;
  getRegisteredHotkeys: () => RegisteredHotkey[];
}
