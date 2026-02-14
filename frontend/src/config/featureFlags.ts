/**
 * Feature flag: shortcut tooltip hints (sidebar hover tooltips showing keyboard shortcuts).
 * Set env YANTA_ENABLE_TOOLTIP_HINTS=true to enable.
 */
export const ENABLE_TOOLTIP_HINTS =
	typeof import.meta.env !== "undefined" && import.meta.env.YANTA_ENABLE_TOOLTIP_HINTS === true;

/**
 * Feature flag: plugin platform and plugin management UI.
 * Set env YANTA_ENABLE_PLUGINS=true to enable.
 */
export const ENABLE_PLUGINS =
	typeof import.meta.env !== "undefined" && import.meta.env.YANTA_ENABLE_PLUGINS === true;
