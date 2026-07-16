import type * as documentModels from "../../../bindings/yanta/internal/document/models";

type BlockNoteStyleValue = boolean | string | number;

export interface BlockNoteContent {
	type: string;
	text?: string;
	styles?: Record<string, BlockNoteStyleValue>;
	href?: string;
	content?: BlockNoteContent[];
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

export type DocumentKind = "document" | "canvas";

export interface Document {
	path: string;
	projectAlias: string;
	title: string;
	kind: DocumentKind;
	blocks: BlockNoteBlock[];
	scene?: ExcalidrawScene;
	assets?: Record<string, string>;
	tags: string[];
	created: Date;
	updated: Date;
	deletedAt?: string;
	hasCode?: boolean;
	hasImages?: boolean;
	hasLinks?: boolean;
}

export interface ExcalidrawScene {
	elements: ExcalidrawElement[];
	appState?: Record<string, unknown>;
	files?: Record<string, ExcalidrawFile>;
}

export interface ExcalidrawElement {
	id: string;
	type: string;
	[key: string]: unknown;
}

export interface ExcalidrawFile {
	id: string;
	dataURL?: string;
	mimeType?: string;
	[key: string]: unknown;
}

export interface DocumentWithTags extends Document {
	allTags: string[];
}

export interface SaveDocumentRequest {
	path?: string;
	projectAlias: string;
	title: string;
	kind?: DocumentKind;
	blocks?: BlockNoteBlock[];
	scene?: ExcalidrawScene;
	assets?: Record<string, string>;
	tags: string[];
	expectedHash?: string;
}

export function documentFromModel(model: documentModels.Document): Document {
	return {
		path: model.path,
		projectAlias: model.project_alias,
		title: model.title || "Untitled",
		kind: (model.kind || "document") as DocumentKind,
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
	model: documentModels.DocumentWithTags | null,
): DocumentWithTags {
	if (!model) {
		throw new Error("Document model is null");
	}
	const file = model.File;
	const blocks = file?.blocks || [];
	const tags = model.Tags || [];
	const kind = (model.kind || file?.kind || "document") as DocumentKind;

	let scene: ExcalidrawScene | undefined;
	if (file?.scene && typeof file.scene === "string") {
		try {
			scene = JSON.parse(file.scene) as ExcalidrawScene;
		} catch {
			scene = undefined;
		}
	}

	const assets = file?.assets as Record<string, string> | undefined;

	return {
		path: model.path,
		projectAlias: model.project_alias,
		title: model.title || "Untitled",
		kind,
		blocks: blocks as BlockNoteBlock[],
		scene,
		assets,
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

export function documentsFromModels(models: (documentModels.Document | null)[]): Document[] {
	return models.filter((m): m is documentModels.Document => m !== null).map(documentFromModel);
}

export function documentToSaveRequest(
	doc: Document,
	blocks?: BlockNoteBlock[],
	scene?: ExcalidrawScene,
	assets?: Record<string, string>,
): SaveDocumentRequest {
	return {
		path: doc.path || undefined,
		projectAlias: doc.projectAlias,
		title: doc.title,
		kind: doc.kind,
		blocks: blocks ?? doc.blocks,
		scene: scene ?? doc.scene,
		assets: assets ?? doc.assets,
		tags: doc.tags,
	};
}

// Frontend domain blocks serialize to the exact JSON the backend BlockNoteBlock
// model expects (Wails marshals them via SaveRequest.createFrom); this is the
// single audited cast at the save boundary so call sites never reach for it.
export function blocksToModel(blocks: BlockNoteBlock[]): documentModels.BlockNoteBlock[] {
	return blocks as unknown as documentModels.BlockNoteBlock[];
}
