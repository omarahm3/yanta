import { useCallback, useState } from "react";
import { CleanupOrphans, LinkToDocument } from "../../wailsjs/go/asset/Service";
import { DocumentServiceWrapper } from "../services/DocumentService";
import type { BlockNoteBlock } from "../types/Document";
import { extractAssetHashes } from "../utils/assetExtractor";

interface SaveDocumentParams {
	title: string;
	blocks: BlockNoteBlock[];
	tags: string[];
	documentPath?: string;
	projectAlias: string;
}

export const useAutoDocumentSaver = () => {
	const [isSaving, setIsSaving] = useState(false);

	const save = useCallback(async (params: SaveDocumentParams) => {
		setIsSaving(true);
		try {
			const normalizedBlocks = params.blocks.map((block) => {
				if (block.type === "file" && block.props?.url) {
					const url = block.props.url as string;
					if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
						return {
							...block,
							type: "image",
							props: {
								url: url,
							},
						};
					}
				}
				return block;
			});

			const savedPath = await DocumentServiceWrapper.save({
				path: params.documentPath || "",
				projectAlias: params.projectAlias,
				title: params.title || "Untitled",
				blocks: normalizedBlocks,
				tags: params.tags,
			});

			const assetHashes = extractAssetHashes(normalizedBlocks);
			for (const hash of assetHashes) {
				try {
					await LinkToDocument(savedPath, hash);
				} catch (err) {
					console.warn(`Failed to link asset ${hash} to document:`, err);
				}
			}

			try {
				await CleanupOrphans(params.projectAlias);
			} catch (err) {
				console.warn("Failed to cleanup orphaned assets:", err);
			}

			return savedPath;
		} catch (err) {
			throw err;
		} finally {
			setIsSaving(false);
		}
	}, []);

	return {
		save,
		isSaving,
	};
};
