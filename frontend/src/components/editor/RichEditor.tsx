import React, { useEffect } from "react";
import "@blocknote/core/fonts/inter.css";
import type { BlockNoteEditor } from "@blocknote/core";
import { Block, PartialBlock, BlockNoteSchema, createCodeBlockSpec } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/shadcn/style.css";
import { codeBlockOptions } from "@blocknote/code-block";
import { uploadFile } from "../../utils/assetUpload";
import { useProjectContext } from "../../contexts";
import "../../styles/blocknote-dark.css";
import { cn } from "../../lib/utils";
import { BlockNoteBlock } from "../../types/Document";
import { extractTitleFromBlocks } from "../../utils/documentUtils";
import { Environment } from "../../../wailsjs/runtime/runtime";
import { registerClipboardImagePlugin } from "../../utils/clipboard";

export interface RichEditorProps {
  initialContent?: string;
  onChange?: (blocks: Block[]) => void;
  onTitleChange?: (title: string) => void;
  onReady?: (editor: BlockNoteEditor) => void;
  className?: string;
  editable?: boolean;
  isLoading?: boolean;
  docKey?: string;
}

const createDefaultInitialBlock = (): PartialBlock => ({
  type: "heading",
  props: { level: 1 },
  content: [
    {
      type: "text",
      text: "",
      styles: {},
    },
  ],
});

type EditorInnerProps = {
  blocks: PartialBlock[];
  onChange?: (blocks: Block[]) => void;
  onTitleChange?: (title: string) => void;
  onReady?: (editor: BlockNoteEditor) => void;
  className?: string;
  editable: boolean;
};

const EditorInner: React.FC<EditorInnerProps> = ({
  blocks,
  onChange,
  onTitleChange,
  onReady,
  className,
  editable,
}) => {
  const { currentProject } = useProjectContext();
  const [isLinux, setIsLinux] = React.useState(false);

  const uploadFileFn = React.useCallback(
    async (file: File) => {
      const alias = currentProject?.alias ?? "";
      if (!alias) throw new Error("No project selected");
      return await uploadFile(file, alias);
    },
    [currentProject],
  );

  const schema = React.useMemo(
    () =>
      BlockNoteSchema.create().extend({
        blockSpecs: {
          codeBlock: createCodeBlockSpec(codeBlockOptions),
        },
      }),
    []
  );

  const editor = useCreateBlockNote({
    schema,
    initialContent: blocks,
    uploadFile: uploadFileFn,
    domAttributes: {
      editor: {
        class: "bn-editor",
      },
    },
  });
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    if (!editor) return;

    let cancelled = false;

    const ensureImageAccept = async () => {
      try {
        const env = await Environment();
        if (cancelled) return;

        const platform = env?.platform?.toLowerCase?.() ?? "";
        const isLinuxPlatform = platform.includes("linux");
        setIsLinux(isLinuxPlatform);
        if (!isLinuxPlatform) {
          return;
        }

        const imageSpec = editor.schema.blockSpecs?.image;
        if (!imageSpec || !imageSpec.implementation) {
          return;
        }

        const meta = imageSpec.implementation.meta ?? {};
        const acceptList = Array.isArray(meta.fileBlockAccept)
          ? meta.fileBlockAccept.filter(
            (entry) => typeof entry === "string" && entry.trim().length > 0,
          )
          : [];

        if (
          acceptList.length === 0 ||
          acceptList.every((entry) => entry === "*/*")
        ) {
          imageSpec.implementation.meta = {
            ...meta,
            fileBlockAccept: ["image/*"],
          };
        }
      } catch (err) {
        console.warn(
          "[RichEditor] Failed to apply Linux image accept workaround",
          err,
        );
      }
    };

    void ensureImageAccept();

    return () => {
      cancelled = true;
    };
  }, [editor]);

  useEffect(() => {
    if (editor) {
      setTimeout(() => {
        setIsReady(true);
        if (onReady) onReady(editor);
      }, 50);
    }
  }, [editor, onReady]);

  useEffect(() => {
    if (editor && editable && isReady) {
      setTimeout(() => {
        editor.focus();
      }, 0);
    }
  }, [editor, editable, isReady]);

  const convertedBlocksRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!editor || !onChange) return;
    const unsubscribe = editor.onChange(() => {
      const currentBlocks = editor.document;

      currentBlocks.forEach((block: Block) => {
        if (
          block.type === "file" &&
          block.props?.url &&
          !convertedBlocksRef.current.has(block.id)
        ) {
          const url = block.props.url as string;
          if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
            convertedBlocksRef.current.add(block.id);
            editor.updateBlock(block.id, {
              type: "image",
              props: {
                url: url,
              },
            });
          }
        }
      });

      onChange(currentBlocks);
      if (onTitleChange) {
        const title = extractTitleFromBlocks(currentBlocks as BlockNoteBlock[]);
        onTitleChange(title);
      }
    });
    return unsubscribe;
  }, [editor, onChange, onTitleChange]);

  useEffect(() => {
    if (editor) editor.isEditable = editable;
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || !isReady || !isLinux) {
      return;
    }

    const unregister = registerClipboardImagePlugin(editor, {
      shouldHandlePaste: () => editable,
      uploadFile: uploadFileFn,
    });

    return unregister;
  }, [editor, uploadFileFn, editable, isReady, isLinux]);

  if (!editor || !isReady) {
    return <div className={cn("h-full w-full", className)} />;
  }

  return (
    <div className={cn("rich-editor flex-1 overflow-y-auto h-full", className)}>
      <BlockNoteView editor={editor} theme="dark" />
    </div>
  );
};

export const RichEditor: React.FC<RichEditorProps> = ({
  initialContent,
  onChange,
  onTitleChange,
  onReady,
  className,
  editable = true,
  isLoading = false,
  docKey,
}) => {
  const parsed = React.useMemo(() => {
    if (isLoading)
      return { ready: false as const, blocks: [] as PartialBlock[] };
    if (!initialContent || initialContent.trim() === "") {
      return { ready: true as const, blocks: [createDefaultInitialBlock()] };
    }
    try {
      const parsed = JSON.parse(initialContent);
      const blocks: PartialBlock[] = Array.isArray(parsed)
        ? (parsed as PartialBlock[])
        : [];
      if (
        blocks.length === 0 ||
        blocks[0].type !== "heading" ||
        blocks[0].props?.level !== 1
      ) {
        return {
          ready: true as const,
          blocks: [createDefaultInitialBlock(), ...blocks],
        };
      }
      return { ready: true as const, blocks };
    } catch (e) {
      console.error("Failed to parse initial content:", e);
      return { ready: true as const, blocks: [createDefaultInitialBlock()] };
    }
  }, [initialContent, isLoading]);

  if (!parsed.ready) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-text-dim">Loading document...</div>
      </div>
    );
  }

  const contentKey =
    docKey ??
    (initialContent && initialContent.trim() !== ""
      ? "__content__"
      : "__empty__");

  return (
    <EditorInner
      key={contentKey}
      blocks={parsed.blocks}
      onChange={onChange}
      onTitleChange={onTitleChange}
      onReady={onReady}
      className={className}
      editable={editable}
    />
  );
};
