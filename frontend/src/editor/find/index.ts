export { FindBar } from "./FindBar";

/** Controls threaded from the document controller down to the editor's find bar. */
export interface DocumentFindControls {
	isOpen: boolean;
	onClose: () => void;
	/** Whether the replace row is shown. */
	showReplace: boolean;
	/** Toggle the replace row (opening find if needed). */
	onToggleReplace: () => void;
	/** Refocus the find input and optionally seed with selection text. */
	onRefocus?: (seedFromSelection?: boolean) => void;
}
