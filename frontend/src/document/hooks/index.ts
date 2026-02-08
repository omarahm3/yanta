// Primary controller hook

export type {
	DocumentControllerOptions,
	DocumentControllerResult,
} from "./useDocumentController";
export { useDocumentController } from "./useDocumentController";

// Supporting hooks (domain-internal, not exported from public API)
export { useDocumentEditor } from "./useDocumentEditor";
export { useDocumentEscapeHandling } from "./useDocumentEscapeHandling";
export { useDocumentForm } from "./useDocumentForm";
export { useDocumentInitialization } from "./useDocumentInitialization";
export { useDocumentLoader } from "./useDocumentLoader";
export { useDocumentPersistence } from "./useDocumentPersistence";
export { useAutoDocumentSaver } from "./useDocumentSaver";
