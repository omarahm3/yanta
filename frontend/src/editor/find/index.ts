export { FindBar } from "./FindBar";

/** Controls threaded from the document controller down to the editor's find bar. */
export interface DocumentFindControls {
	isOpen: boolean;
	onClose: () => void;
}
