import * as documentModels from "../../../bindings/yanta/internal/document/models";
import {
	Get,
	GetDocumentHash,
	ListByProject,
	ListRecent,
	MoveToProject,
	Restore,
	Save,
	SoftDelete,
} from "../../../bindings/yanta/internal/document/service";
import { recordDocumentGetInFlightDelta, recordDocumentGetTiming } from "../monitoring/appMonitor";
import {
	blocksToModel,
	type Document,
	type DocumentWithTags,
	documentsFromModels,
	documentWithTagsFromModel,
	type SaveDocumentRequest,
} from "../types/Document";

export async function saveDocument(request: SaveDocumentRequest): Promise<string> {
	const backendRequest = new documentModels.SaveRequest({
		Path: request.path || "",
		ProjectAlias: request.projectAlias,
		Title: request.title,
		Kind: request.kind || "document",
		Blocks: request.blocks ? blocksToModel(request.blocks) : [],
		// Send the scene as a JSON object, not a stringified blob: the backend stores
		// it in a json.RawMessage and validates it must be a JSON object for canvas
		// kind. Double-encoding it to a string fails that validation and corrupts the
		// file (scene reads back as a bare string).
		Scene: request.scene ?? null,
		// Persist the fileId -> vault ref map for canvas docs so the backend can
		// link these images in doc_asset (keeps them out of orphan cleanup).
		Assets: request.assets || {},
		Tags: request.tags,
		ExpectedHash: request.expectedHash || "",
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

export async function listRecentDocuments(limit: number = 50): Promise<Document[]> {
	const models = await ListRecent(limit);
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

export async function getDocumentHash(path: string): Promise<string> {
	return await GetDocumentHash(path);
}

// Legacy wrapper for backward compatibility
export const DocumentServiceWrapper = {
	save: saveDocument,
	get: getDocument,
	getHash: getDocumentHash,
	listByProject: listDocumentsByProject,
	listRecent: listRecentDocuments,
	softDelete: softDeleteDocument,
	restore: restoreDocument,
	moveToProject: moveDocumentToProject,
};
