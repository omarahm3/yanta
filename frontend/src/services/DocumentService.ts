import {
  Get,
  ListByProject,
  Save,
  SoftDelete,
  Restore,
} from "../../wailsjs/go/document/Service";
import { document } from "../../wailsjs/go/models";
import {
  Document,
  DocumentWithTags,
  SaveDocumentRequest,
  documentWithTagsFromModel,
  documentsFromModels,
} from "../types/Document";

export class DocumentServiceWrapper {
  static async save(request: SaveDocumentRequest): Promise<string> {
    const backendRequest = new document.SaveRequest({
      Path: request.path || "",
      ProjectAlias: request.projectAlias,
      Title: request.title,
      Blocks: request.blocks,
      Tags: request.tags,
    });

    return await Save(backendRequest);
  }

  static async get(path: string): Promise<DocumentWithTags> {
    console.log('[DocumentService] get() called with path:', path);
    try {
      console.log('[DocumentService] Calling Wails Get() function...');
      const model = await Get(path);
      console.log('[DocumentService] Wails Get() returned model:', {
        path: model?.path,
        title: model?.title,
        hasFile: !!model?.File,
        blocksCount: model?.File?.blocks?.length || 0,
        tagsCount: model?.Tags?.length || 0,
        rawModel: model,
      });

      console.log('[DocumentService] Transforming model to DocumentWithTags...');
      const result = documentWithTagsFromModel(model);
      console.log('[DocumentService] Transformation complete:', {
        path: result.path,
        title: result.title,
        blocksCount: result.blocks?.length || 0,
        tagsCount: result.tags?.length || 0,
        result,
      });

      return result;
    } catch (error) {
      console.error('[DocumentService] Error in get():', error);
      throw error;
    }
  }

  static async listByProject(
    projectAlias: string,
    includeArchived: boolean = false,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Document[]> {
    const models = await ListByProject(
      projectAlias,
      includeArchived,
      limit,
      offset,
    );
    return documentsFromModels(models);
  }

  static async softDelete(path: string): Promise<void> {
    await SoftDelete(path);
  }

  static async restore(path: string): Promise<void> {
    await Restore(path);
  }
}
