/**
 * Generated type stubs for Wails bindings - document/models
 * These are placeholder types that mirror the Go backend structures
 */

export interface BlockNoteBlock {
	id?: string;
	type?: string;
	props?: Record<string, unknown>;
	content?: unknown[];
	children?: BlockNoteBlock[];
}

export interface FileContent {
	blocks?: BlockNoteBlock[];
}

export interface Document {
	path: string;
	project_alias: string;
	title?: string;
	tags?: string[];
	created_at?: string;
	updated_at?: string;
	deleted_at?: string;
	has_code?: boolean;
	has_images?: boolean;
	has_links?: boolean;
}

export interface DocumentWithTags extends Document {
	File?: FileContent;
	Tags?: string[];
}

export class SaveRequest {
	Path: string = "";
	ProjectAlias: string = "";
	Title: string = "";
	Blocks: BlockNoteBlock[] = [];
	Tags: string[] = [];

	constructor(data?: Partial<SaveRequest>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}
