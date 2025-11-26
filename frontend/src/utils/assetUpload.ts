/**
 * Asset upload using chunked RPC calls.
 * Bypasses WebView2 limitation where binary multipart POST data is not accessible.
 * Works on all platforms: Linux (WebKitGTK), Windows (WebView2), macOS (WebKit).
 */

import * as AssetService from "../../bindings/yanta/internal/asset/service";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 256 * 1024; // 256KB chunks

export async function uploadFile(file: File, projectAlias: string): Promise<string> {
	if (!projectAlias) {
		throw new Error("No project selected");
	}
	if (file.size === 0) {
		throw new Error("Empty file");
	}
	if (file.size > MAX_BYTES) {
		throw new Error(`File too large (max ${MAX_BYTES / (1024 * 1024)}MB)`);
	}

	const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
	const filename = file.name || `image.${file.type.split("/")[1] || "png"}`;

	const startResp = await AssetService.StartChunkedUpload({
		projectAlias,
		filename,
		totalSize: file.size,
		totalChunks,
		mimeType: file.type,
	});

	if (!startResp?.uploadId) {
		throw new Error("Failed to start upload session");
	}

	const uploadId = startResp.uploadId;

	try {
		for (let i = 0; i < totalChunks; i++) {
			const start = i * CHUNK_SIZE;
			const end = Math.min(start + CHUNK_SIZE, file.size);
			const chunk = file.slice(start, end);

			const base64 = await blobToBase64(chunk);

			await AssetService.UploadChunk({
				uploadId,
				chunkIndex: i,
				data: base64,
			});
		}

		const result = await AssetService.FinalizeChunkedUpload(uploadId);

		if (!result?.url) {
			throw new Error("Upload succeeded but no URL returned");
		}

		return result.url;
	} catch (error) {
		try {
			await AssetService.AbortChunkedUpload(uploadId);
		} catch {
			// Ignore abort errors
		}
		throw error;
	}
}

async function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const result = reader.result as string;
			const base64 = result.split(",")[1];
			resolve(base64);
		};
		reader.onerror = () => reject(new Error("Failed to read file chunk"));
		reader.readAsDataURL(blob);
	});
}
