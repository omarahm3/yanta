/**
 * Asset upload using HTTP POST with multipart/form-data.
 * Bypasses Wails RPC which has URL length limits due to base64 data in query params.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

interface UploadResponse {
	success: boolean;
	hash?: string;
	ext?: string;
	url?: string;
	bytes?: number;
	mime?: string;
	error?: string;
}

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

	const fileName = file.name || `image.${file.type.split("/")[1] || "png"}`;

	console.debug("[Upload] Starting:", { project: projectAlias, filename: fileName, size: file.size });

	const formData = new FormData();
	formData.append("project", projectAlias);
	formData.append("file", file, fileName);

	try {
		const response = await fetch("/api/upload", {
			method: "POST",
			body: formData,
		});

		const result: UploadResponse = await response.json();

		if (!response.ok || !result.success) {
			const errorMessage = result.error || `HTTP ${response.status}: ${response.statusText}`;
			console.error("[Upload] Failed:", { status: response.status, error: errorMessage });
			throw new Error(errorMessage);
		}

		console.debug("[Upload] Success:", { hash: result.hash, ext: result.ext, bytes: result.bytes });

		if (!result.url) {
			throw new Error("Upload succeeded but no URL returned");
		}

		return result.url;
	} catch (error) {
		if (error instanceof TypeError && error.message.includes("fetch")) {
			console.error("[Upload] Network error:", error);
			throw new Error("Upload failed: Network error");
		}
		throw error;
	}
}
