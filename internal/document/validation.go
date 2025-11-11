package document

import (
	"encoding/json"
	"fmt"
)

func ValidateBlockNoteStructure(blocks []BlockNoteBlock) error {
	for i, block := range blocks {
		if err := validateBlock(block, 0); err != nil {
			return fmt.Errorf("block %d invalid: %w", i, err)
		}
		if err := validateContent(block.Content, block.Type); err != nil {
			return fmt.Errorf("block %d content invalid: %w", i, err)
		}
	}
	return nil
}

func validateContent(rawContent json.RawMessage, blockType string) error {
	if len(rawContent) == 0 {
		return nil
	}

	if blockType == "table" {
		return nil
	}

	var content []BlockNoteContent
	if err := json.Unmarshal(rawContent, &content); err != nil {
		return fmt.Errorf("failed to unmarshal content: %w", err)
	}

	return validateContentSlice(content)
}

func validateContentSlice(content []BlockNoteContent) error {
	for i, item := range content {
		if item.Type == "" {
			return fmt.Errorf("content[%d]: type is required", i)
		}

		if item.Type == "link" {
			if item.Href == "" {
				return fmt.Errorf("content[%d]: link must have href", i)
			}
			if len(item.Content) == 0 {
				return fmt.Errorf("content[%d]: link must have nested content array", i)
			}
			if err := validateContentSlice(item.Content); err != nil {
				return fmt.Errorf("content[%d] nested: %w", i, err)
			}
		}

		if item.Type == "text" {
			if item.Styles == nil {
				return fmt.Errorf("content[%d]: text must have styles map (can be empty)", i)
			}
		}
	}
	return nil
}
