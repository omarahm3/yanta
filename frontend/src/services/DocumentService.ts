import * as documentModels from "../../bindings/yanta/internal/document/models";
import {
	Get,
	ListByProject,
	Restore,
	Save,
	SoftDelete,
} from "../../bindings/yanta/internal/document/service";
import {
	type Document,
	type DocumentWithTags,
	documentsFromModels,
	documentWithTagsFromModel,
	type SaveDocumentRequest,
} from "../types/Document";

export class DocumentServiceWrapper {
	static async save(request: SaveDocumentRequest): Promise<string> {
		const backendRequest = new documentModels.SaveRequest({
			Path: request.path || "",
			ProjectAlias: request.projectAlias,
			Title: request.title,
			Blocks: request.blocks as unknown as documentModels.BlockNoteBlock[],
			Tags: request.tags,
		});

		return await Save(backendRequest);
	}

	static async get(path: string): Promise<DocumentWithTags> {
		const model = await Get(path);
		return documentWithTagsFromModel(model);
	}

	static async listByProject(
		projectAlias: string,
		includeArchived: boolean = false,
		limit: number = 50,
		offset: number = 0,
	): Promise<Document[]> {
		const models = await ListByProject(projectAlias, includeArchived, limit, offset);
		return documentsFromModels(models);
	}

	static async softDelete(path: string): Promise<void> {
		await SoftDelete(path);
	}

	static async restore(path: string): Promise<void> {
		await Restore(path);
	}
}
