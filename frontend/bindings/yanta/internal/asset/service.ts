/**
 * Generated type stubs for Wails bindings - asset/service
 */

export interface UploadResult {
	path: string;
	url: string;
}

export interface StartChunkedUploadRequest {
	projectAlias: string;
	filename: string;
	totalSize: number;
	totalChunks: number;
	mimeType: string;
}

export interface StartChunkedUploadResponse {
	uploadId: string;
}

export interface UploadChunkRequest {
	uploadId: string;
	chunkIndex: number;
	data: string;
}

export interface FinalizeUploadResponse {
	url: string;
	path: string;
}

export function CleanupOrphans(_projectAlias: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function LinkToDocument(_documentPath: string, _assetHash: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function Upload(_data: string, _filename: string): Promise<UploadResult> {
	throw new Error("Wails binding not available");
}

export function StartChunkedUpload(_request: StartChunkedUploadRequest): Promise<StartChunkedUploadResponse> {
	throw new Error("Wails binding not available");
}

export function UploadChunk(_request: UploadChunkRequest): Promise<void> {
	throw new Error("Wails binding not available");
}

export function FinalizeChunkedUpload(_uploadId: string): Promise<FinalizeUploadResponse> {
	throw new Error("Wails binding not available");
}

export function AbortChunkedUpload(_uploadId: string): Promise<void> {
	throw new Error("Wails binding not available");
}
