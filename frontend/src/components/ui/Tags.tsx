import React from "react";
import { cn } from "../../lib/utils";

export interface Tag {
  id: string;
  label: string;
  type?: "feature" | "bug" | "learn" | "default";
  onClick?: () => void;
}

export interface TagsProps {
  tags: Tag[];
  className?: string;
}

export const Tags: React.FC<TagsProps> = ({ tags, className }) => {
  const getTagClasses = (tag: Tag) => {
    const baseClasses =
      "inline-flex items-center px-2.5 py-1 bg-surface border border-border rounded-full text-xs cursor-pointer transition-all";

    switch (tag.type) {
      case "feature":
        return cn(
          baseClasses,
          "text-green border-green bg-green/10 hover:bg-green/20",
        );
      case "bug":
        return cn(baseClasses, "text-red border-red bg-red/10 hover:bg-red/20");
      case "learn":
        return cn(
          baseClasses,
          "text-yellow border-yellow bg-yellow/10 hover:bg-yellow/20",
        );
      default:
        return cn(
          baseClasses,
          "text-accent hover:bg-surface-hover hover:border-accent",
        );
    }
  };

  return (
    <div className={cn("mt-3 pt-3 border-t border-border", className)}>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={getTagClasses(tag)}
            onClick={tag.onClick}
          >
            {tag.label}
          </span>
        ))}
      </div>
    </div>
  );
};
