import React from "react";
import { Document } from "../types/Document";
import { formatShortDate } from "../utils/dateUtils";

interface DocumentListProps {
  documents: Document[];
  onDocumentClick: (path: string) => void;
  selectedIndex?: number;
  onSelectDocument?: (index: number) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onDocumentClick,
  selectedIndex = 0,
  onSelectDocument,
}) => {
  if (documents.length === 0) {
    const placeholders: Document[] = [
      {
        path: "projects/work/doc-placeholder1.json",
        projectAlias: "work",
        title: "Sample Document 1",
        blocks: [],
        tags: ["sample", "placeholder"],
        created: new Date(),
        updated: new Date(),
      },
      {
        path: "projects/work/doc-placeholder2.json",
        projectAlias: "work",
        title: "Sample Document 2",
        blocks: [],
        tags: ["demo"],
        created: new Date(),
        updated: new Date(),
      },
    ];

    return (
      <div className="document-list opacity-50">
        {placeholders.map((doc) => (
          <div
            key={doc.path}
            className="document-item p-4 border-b border-border"
          >
            <h3 className="text-lg font-semibold text-text">{doc.title}</h3>
            <div className="document-meta flex gap-4 mt-2 text-sm text-text-dim">
              <span>{doc.projectAlias}</span>
              <span>{formatShortDate(doc.updated.toISOString())}</span>
            </div>
            <div className="document-tags flex gap-2 mt-2">
              {doc.tags.map((tag) => (
                <span
                  key={tag}
                  className="tag px-2 py-1 text-xs bg-surface rounded text-text-dim"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="text-sm text-text-dim mt-4 p-4">
          No documents yet. Create one to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="document-list">
      {documents.map((doc, index) => {
        const isSelected = index === selectedIndex;
        return (
          <div
            key={doc.path}
            onClick={() => {
              onSelectDocument?.(index);
              onDocumentClick(doc.path);
            }}
            onMouseEnter={() => onSelectDocument?.(index)}
            className={`document-item p-4 border-b cursor-pointer transition-colors ${
              isSelected
                ? "border-l-4 border-l-accent bg-surface border-border"
                : "border-border hover:bg-surface"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`text-sm font-mono flex-shrink-0 ${
                  isSelected ? "text-accent" : "text-text-dim"
                }`}
              >
                {index + 1}.
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text">{doc.title}</h3>
                <div className="document-meta flex gap-4 mt-2 text-sm text-text-dim">
                  <span>{doc.projectAlias}</span>
                  <span>{formatShortDate(doc.updated.toISOString())}</span>
                </div>
                <div className="document-tags flex gap-2 mt-2">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="tag px-2 py-1 text-xs bg-bg-dark rounded text-text-dim"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
