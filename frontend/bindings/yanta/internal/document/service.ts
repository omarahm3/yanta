/**
 * Generated type stubs for Wails bindings - document/service
 */

import type { Document, DocumentWithTags, SaveRequest } from "./models";

export function Get(_path: string): Promise<DocumentWithTags | null> {
	throw new Error("Wails binding not available");
}

export function ListByProject(
	_projectAlias: string,
	_includeArchived: boolean,
	_limit: number,
	_offset: number,
): Promise<(Document | null)[]> {
	throw new Error("Wails binding not available");
}

export function Save(_request: SaveRequest): Promise<string> {
	throw new Error("Wails binding not available");
}

export function SoftDelete(_path: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function Restore(_path: string): Promise<void> {
	throw new Error("Wails binding not available");
}
