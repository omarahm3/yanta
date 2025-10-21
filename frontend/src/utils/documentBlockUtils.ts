import { BlockNoteBlock } from "../types/Document";

export const createTitleBlock = (title: string): BlockNoteBlock => ({
  id: crypto.randomUUID(),
  type: "heading",
  props: { level: 1 },
  content: [
    {
      type: "text",
      text: title,
      styles: {},
    },
  ],
});

export const createEmptyDocument = (title?: string) => ({
  title: title || "",
  blocks: title ? [createTitleBlock(title)] : [],
  tags: [],
});
