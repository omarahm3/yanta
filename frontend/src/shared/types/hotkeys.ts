export interface HotkeyConfig {
	key: string;
	// biome-ignore lint/suspicious/noConfusingVoidType: void is intentional here - handlers may return nothing or a boolean
	handler: (event: KeyboardEvent) => void | boolean;
	allowInInput?: boolean;
	description?: string;
	category?: string;
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
