// Public API for document domain
export { Document } from "./DocumentPage";
export type { DocumentProps } from "./DocumentPage";
export { useDocumentController } from "./hooks/useDocumentController";
export type {
	DocumentControllerOptions,
	DocumentControllerResult,
} from "./hooks/useDocumentController";
export {
	DocumentProvider,
	useDocumentContext,
	DocumentCountProvider,
	useDocumentCount,
} from "./context";
