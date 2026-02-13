// Public API for document domain

export {
	DocumentCountProvider,
	DocumentProvider,
	useDocumentContext,
	useDocumentCount,
} from "./context";
export type { DocumentProps } from "./DocumentPage";
export { Document } from "./DocumentPage";
export type {
	DocumentControllerOptions,
	DocumentControllerResult,
} from "./hooks/useDocumentController";
export { useDocumentController } from "./hooks/useDocumentController";
