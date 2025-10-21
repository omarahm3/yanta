import { document } from "../../wailsjs/go/models";

type BlockNoteStyleValue = boolean | string | number;

export interface BlockNoteContent {
  type: string;
  text?: string;
  styles?: Record<string, BlockNoteStyleValue>;
  href?: string;
}

type BlockNotePropValue = string | number | boolean | null;

export interface BlockNoteBlock {
  id: string;
  type: string;
  props?: Record<string, BlockNotePropValue>;
  content?: BlockNoteContent[];
  children?: BlockNoteBlock[];
}

export interface DocumentMeta {
  project: string;
  title: string;
  tags: string[];
  aliases: string[];
  created: string;
  updated: string;
}

export interface Document {
  path: string;
  projectAlias: string;
  title: string;
  blocks: BlockNoteBlock[];
  tags: string[];
  created: Date;
  updated: Date;
  deletedAt?: string;
  hasCode?: boolean;
  hasImages?: boolean;
  hasLinks?: boolean;
}

export interface DocumentWithTags extends Document {
  allTags: string[];
}

export interface SaveDocumentRequest {
  path?: string;
  projectAlias: string;
  title: string;
  blocks: BlockNoteBlock[];
  tags: string[];
}

export function documentFromModel(model: document.Document): Document {
  return {
    path: model.path,
    projectAlias: model.project_alias,
    title: model.title || "Untitled",
    blocks: [],
    tags: model.tags || [],
    created: new Date(model.created_at || Date.now()),
    updated: new Date(model.updated_at || Date.now()),
    deletedAt: model.deleted_at || undefined,
    hasCode: model.has_code || false,
    hasImages: model.has_images || false,
    hasLinks: model.has_links || false,
  };
}

export function documentWithTagsFromModel(
  model: document.DocumentWithTags,
): DocumentWithTags {
  const blocks = model.File?.blocks || [];
  const tags = model.Tags || [];

  return {
    path: model.path,
    projectAlias: model.project_alias,
    title: model.title || "Untitled",
    blocks: blocks as BlockNoteBlock[],
    tags: tags,
    created: new Date(model.created_at || Date.now()),
    updated: new Date(model.updated_at || Date.now()),
    deletedAt: model.deleted_at || undefined,
    hasCode: model.has_code || false,
    hasImages: model.has_images || false,
    hasLinks: model.has_links || false,
    allTags: model.Tags || [],
  };
}

export function documentsFromModels(models: document.Document[]): Document[] {
  return models.map(documentFromModel);
}

export function documentToSaveRequest(
  doc: Document,
  blocks: BlockNoteBlock[],
): SaveDocumentRequest {
  return {
    path: doc.path || undefined,
    projectAlias: doc.projectAlias,
    title: doc.title,
    blocks: blocks,
    tags: doc.tags,
  };
}
