/**
 * Barrel: pane layout utilities split into focused modules.
 * - paneId: generatePaneId
 * - paneTreeQueries: findPane, countLeaves, getLeaves, getLeafPaths, getPathToLeaf, PathStep
 * - paneTreeMutations: splitPane, closePane, resizePane, openDocumentInPane, updateScrollPosition, moveDocumentBetweenPanes, swapPaneDocuments
 * - paneLayoutValidation: validateLayout, restoreLayout
 * - paneNavigation: getNextLeafId, getPreviousLeafId, getPaneInDirection, PaneDirection
 */

export { generatePaneId } from "./paneId";

export {
	countLeaves,
	findPane,
	getLeafPaths,
	getLeaves,
	getPathToLeaf,
	type PathStep,
} from "./paneTreeQueries";

export {
	closePane,
	moveDocumentBetweenPanes,
	openDocumentInPane,
	resizePane,
	splitPane,
	swapPaneDocuments,
	updateScrollPosition,
} from "./paneTreeMutations";

export { restoreLayout, validateLayout } from "./paneLayoutValidation";

export {
	getNextLeafId,
	getPaneInDirection,
	getPreviousLeafId,
	type PaneDirection,
} from "./paneNavigation";
