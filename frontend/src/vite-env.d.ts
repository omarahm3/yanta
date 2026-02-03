/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly YANTA_ENABLE_TOOLTIP_HINTS: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
