import * as documentModels from "../../../bindings/yanta/internal/document/models";
import {
	Get,
	ListByProject,
	MoveToProject,
	Restore,
	Save,
	SoftDelete,
} from "../../../bindings/yanta/internal/document/service";
import {
	type Document,
	type DocumentWithTags,
	documentsFromModels,
	documentWithTagsFromModel,
	type SaveDocumentRequest,
} from "../types/Document";
import {
	recordDocumentGetInFlightDelta,
	recordDocumentGetTiming,
} from "../monitoring/appMonitor";

export async function saveDocument(request: SaveDocumentRequest): Promise<string> {
	const backendRequest = new documentModels.SaveRequest({
		Path: request.path || "",
		ProjectAlias: request.projectAlias,
		Title: request.title,
		Blocks: request.blocks as unknown as documentModels.BlockNoteBlock[],
		Tags: request.tags,
	});

	return await Save(backendRequest);
}

export async function getDocument(path: string): Promise<DocumentWithTags> {
	const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
	recordDocumentGetInFlightDelta(1);
	try {
		const model = await Get(path);
		const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
		recordDocumentGetTiming(finishedAt - startedAt, true);
		return documentWithTagsFromModel(model);
	} catch (err) {
		const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
		recordDocumentGetTiming(finishedAt - startedAt, false);
		throw err;
	} finally {
		recordDocumentGetInFlightDelta(-1);
	}
}

export async function listDocumentsByProject(
	projectAlias: string,
	includeArchived: boolean = false,
	limit: number = 50,
	offset: number = 0,
): Promise<Document[]> {
	const models = await ListByProject(projectAlias, includeArchived, limit, offset);
	return documentsFromModels(models);
}

export async function softDeleteDocument(path: string): Promise<void> {
	await SoftDelete(path);
}

export async function restoreDocument(path: string): Promise<void> {
	await Restore(path);
}

export async function moveDocumentToProject(
	path: string,
	targetProjectAlias: string,
): Promise<void> {
	await MoveToProject(path, targetProjectAlias);
}

// Legacy wrapper for backward compatibility
export const DocumentServiceWrapper = {
	save: saveDocument,
	get: getDocument,
	listByProject: listDocumentsByProject,
	softDelete: softDeleteDocument,
	restore: restoreDocument,
	moveToProject: moveDocumentToProject,
};
