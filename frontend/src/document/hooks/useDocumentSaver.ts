import { useCallback, useState } from "react";
import { CleanupOrphans, LinkToDocument } from "../../../bindings/yanta/internal/asset/service";
import { isImageFileUrl } from "../../editor/utils/blockNormalize";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
import type { BlockNoteBlock, DocumentKind, ExcalidrawScene } from "../../shared/types/Document";
import { extractAssetHashes } from "../utils/assetExtractor";

interface SaveDocumentParams {
	title: string;
	blocks: BlockNoteBlock[];
	tags: string[];
	documentPath?: string;
	projectAlias: string;
	expectedHash?: string;
	kind?: DocumentKind;
	scene?: ExcalidrawScene;
	assets?: Record<string, string>;
}

// Orphan cleanup is a full-project scan; running it on every debounced autosave
// (i.e. every few keystrokes) is wasteful and needlessly widens the window in
// which a not-yet-linked asset from another open document could be reaped.
// Throttle it — the backend keeps a grace period so freshly uploaded assets are
// never eligible for deletion within this interval anyway.
const ORPHAN_CLEANUP_MIN_INTERVAL_MS = 2 * 60 * 1000;
let lastOrphanCleanupAt = 0;

export const useAutoDocumentSaver = () => {
	const [isSaving, setIsSaving] = useState(false);

	const save = useCallback(async (params: SaveDocumentParams) => {
		setIsSaving(true);
		try {
			const normalizedBlocks = params.blocks.map((block) => {
				if (block.type === "file" && block.props?.url) {
					const url = block.props.url as string;
					if (isImageFileUrl(url)) {
						const caption = block.props.caption;
						return {
							...block,
							type: "image",
							props: caption ? { url, caption } : { url },
						};
					}
				}
				return block;
			});

			const savedPath = await DocumentServiceWrapper.save({
				path: params.documentPath || "",
				projectAlias: params.projectAlias,
				title: params.title || "Untitled",
				blocks: params.kind === "canvas" ? [] : normalizedBlocks,
				tags: params.tags,
				expectedHash: params.expectedHash,
				kind: params.kind || "document",
				scene: params.scene,
				assets: params.assets,
			});

			const assetHashes = extractAssetHashes(normalizedBlocks);
			for (const hash of assetHashes) {
				try {
					await LinkToDocument(savedPath, hash);
				} catch (err) {
					console.warn(`Failed to link asset ${hash} to document:`, err);
				}
			}

			const now = Date.now();
			if (now - lastOrphanCleanupAt > ORPHAN_CLEANUP_MIN_INTERVAL_MS) {
				lastOrphanCleanupAt = now;
				try {
					await CleanupOrphans(params.projectAlias);
				} catch (err) {
					console.warn("Failed to cleanup orphaned assets:", err);
				}
			}

			return savedPath;
		} finally {
			setIsSaving(false);
		}
	}, []);

	return {
		save,
		isSaving,
	};
};
