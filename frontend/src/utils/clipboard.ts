// TODO: this file is redundant, remove it
/** Compatibility shim: migrate call sites to shared/utils/clipboard then remove. */
export {
	ensureFileHasName,
	extractImagesFromClipboardEvent,
	registerClipboardImagePlugin,
} from "../shared/utils/clipboard";
export type {
	ClipboardImageSource,
	ClipboardImageExtraction,
	ClipboardPluginOptions,
} from "../shared/utils/clipboard";
