import { BuildURL, Upload } from "../../bindings/yanta/internal/asset/service";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000; // Prevent call stack overflow on large files
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

export async function uploadFile(file: File, projectAlias: string): Promise<string> {
	if (!projectAlias) throw new Error("No project selected");
	if (file.size === 0) throw new Error("Empty file");
	if (file.size > MAX_BYTES) throw new Error("File too large (max 10MB)");

	const buffer = await file.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	const base64 = uint8ArrayToBase64(bytes);
	const fileName = file.name || `image.${file.type.split("/")[1] || "png"}`;
	const info = await Upload(projectAlias, base64, fileName);

	if (!info) {
		throw new Error("Upload returned null");
	}

	return await BuildURL(projectAlias, info.Hash, info.Ext);
}
