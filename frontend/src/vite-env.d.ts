/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly YANTA_ENABLE_TOOLTIP_HINTS: boolean;
	readonly YANTA_ENABLE_APP_MONITOR: boolean;
	readonly YANTA_ENABLE_COMMAND_LINE: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
