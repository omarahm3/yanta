import { BlockNoteBlock } from "../types/Document";

/**
 * Extracts SHA-256 asset hashes from image blocks.
 * Used to track which assets are referenced by a document.
 */
export function extractAssetHashes(blocks: BlockNoteBlock[]): string[] {
  const hashes: string[] = [];

  const traverse = (blocks: BlockNoteBlock[]) => {
    blocks.forEach((block) => {
      if (block.type === "image" && block.props?.url && typeof block.props.url === "string") {
        const match = block.props.url.match(/\/assets\/[^/]+\/([a-f0-9]{64})/);
        if (match) {
          hashes.push(match[1]);
        }
      }

      if (block.children && Array.isArray(block.children)) {
        traverse(block.children as BlockNoteBlock[]);
      }
    });
  };

  traverse(blocks);
  return [...new Set(hashes)];
}
