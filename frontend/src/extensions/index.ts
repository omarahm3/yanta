/** Compatibility shim: migrated to editor/extensions. */

export type { RTLExtensionOptions } from "../editor/extensions";
export {
	detectTextDirection,
	getNodeTextContent,
	hasSignificantRTL,
	RTLExtension,
} from "../editor/extensions";
