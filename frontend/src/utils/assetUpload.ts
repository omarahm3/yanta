import { BuildURL, Upload } from "../../wailsjs/go/asset/Service";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function uploadFile(file: File, projectAlias: string): Promise<string> {
	if (!projectAlias) throw new Error("No project selected");
	if (file.size === 0) throw new Error("Empty file");
	if (file.size > MAX_BYTES) throw new Error("File too large (max 10MB)");

	const buffer = await file.arrayBuffer();
	const bytes = Array.from(new Uint8Array(buffer));
	const fileName = file.name || `image.${file.type.split("/")[1] || "png"}`;
	const info = await Upload(projectAlias, bytes, fileName);
	return await BuildURL(projectAlias, info.Hash, info.Ext);
}
